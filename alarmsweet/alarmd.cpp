#include "miniaudio/miniaudio.h"
#include "base64/base64.hpp"
#include "alarm/defaults.hpp"

#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <memory>
#include <cstdlib>
#include <cctype>
#include <cstring>
#include <curl/curl.h>
#include <nlohmann/json.hpp>
#include <set>
#include <ctime>
#include <thread>
#include <boost/asio.hpp>
#include <queue>
#include <chrono>

class audio_player {
public:
    audio_player(ma_device *device, ma_device_config *deviceConfig, ma_decoder *decoder) {
        this->device = device;
        this->deviceConfig = deviceConfig;
        this->decoder = decoder;
    }
    ~audio_player() {
        ma_device_uninit(this->device);
        ma_decoder_uninit(this->decoder);

        free(this->decoder);
        free(this->deviceConfig);
        free(this->device);
    }
    ma_decoder *decoder;
    ma_device_config *deviceConfig;
    ma_device *device;


};

void data_callback(ma_device* pDevice, void* pOutput, const void* pInput, ma_uint32 frameCount)
{
    ma_decoder* pDecoder = (ma_decoder*)pDevice->pUserData;
    if (pDecoder == NULL) {
        return;
    }

    /* Reading PCM frames will loop based on what we specified when called ma_data_source_set_looping(). */
    ma_data_source_read_pcm_frames(pDecoder, pOutput, frameCount, NULL);

    (void)pInput;
}


audio_player *startRinging(const char *filePath) {
    ma_result result;
    ma_decoder *decoder = (ma_decoder*) malloc(sizeof(ma_decoder));
    ma_device_config *deviceConfig = (ma_device_config*) malloc(sizeof(ma_device_config));
    ma_device *device = (ma_device*) malloc(sizeof(ma_device));

    result = ma_decoder_init_file(filePath, NULL, decoder);
    if (result != MA_SUCCESS) {
        return nullptr;
    }

    /*
     A decoder* is a data source which means we just use ma_data_source_set_looping() to set the
     looping state. We will read data using ma_data_source_read_pcm_frames() in the data callback.
     */
    ma_data_source_set_looping(decoder, MA_TRUE);

    *deviceConfig = ma_device_config_init(ma_device_type_playback);
    deviceConfig->playback.format   = decoder->outputFormat;
    deviceConfig->playback.channels = decoder->outputChannels;
    deviceConfig->sampleRate        = decoder->outputSampleRate;
    deviceConfig->dataCallback      = data_callback;
    deviceConfig->pUserData         = decoder;

    if (ma_device_init(NULL, deviceConfig, device) != MA_SUCCESS) {
        printf("Failed to open playback device.\n");
        ma_decoder_uninit(decoder);
        free(decoder);
        free(deviceConfig);
        free(device);
        return nullptr;
    }

    if (ma_device_start(device) != MA_SUCCESS) {
        printf("Failed to start playback device.\n");
        free(decoder);
        free(deviceConfig);
        free(device);
        ma_device_uninit(device);
        ma_decoder_uninit(decoder);
        return nullptr;
    }

    return new audio_player(device, deviceConfig, decoder);
}

struct MemoryStruct {
    char *memory;
    size_t size;
};

static size_t WriteCallback(void *contents, size_t size, size_t nmemb, void *userp) {
    size_t realsize = size * nmemb;
    struct MemoryStruct *mem = (struct MemoryStruct *)userp;

    char *ptr = (char*) realloc(mem->memory, mem->size + realsize + 1); // +1 for null terminator
    if(ptr == NULL) {
        // Out of memory!
        printf("not enough memory (realloc returned NULL)\n");
        return 0;
    }

    mem->memory = ptr;
    memcpy(&(mem->memory[mem->size]), contents, realsize);
    mem->size += realsize;
    mem->memory[mem->size] = 0; // Null terminate

    return realsize;
}



std::set<time_t> get_alarms(std::string url, std::string username, std::string password, bool doreq = true) {
    std::set<time_t> alarmTimes;

    if (doreq) {
        url = url + "/alarms";
        std::string auth = to_base64(username + ":" + password);

        CURL *curl;
        CURLcode res;

        struct MemoryStruct chunk;

        chunk.memory = NULL;
        chunk.size = 0;

        curl_global_init(CURL_GLOBAL_ALL);

        curl = curl_easy_init();
        if(curl) {
            curl_easy_setopt(curl, CURLOPT_URL, url.c_str()); // Replace with your URL
            curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
            curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
            curl_easy_setopt(curl, CURLOPT_USERAGENT, "libcurl-agent/1.0");

            struct curl_slist *headers = NULL;
            headers = curl_slist_append(headers, ("Authorization: Basic " + auth).c_str());
            curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

            res = curl_easy_perform(curl);

            if(res != CURLE_OK) {
                fprintf(stderr, "curl_easy_perform() failed: %s\n", curl_easy_strerror(res));
            } else {
                printf("Received %zu bytes.\n", chunk.size);
            }

            curl_slist_free_all(headers);
            curl_easy_cleanup(curl);
        }

        curl_global_cleanup();

        // Convert bytes to JSON
        using namespace nlohmann;
        if (chunk.size > 0) {
            json j = json::parse(chunk.memory);
            auto alarms = j["alarms"];
            if (alarms.is_array()) {
                for (const auto& elem : alarms) {
                    if (elem.is_number_unsigned()) {
                        alarmTimes.insert(elem.get<time_t>() / 1000);
                    } else if (elem.is_number_integer()) {
                        alarmTimes.insert(elem.get<time_t>() / 1000);
                    }
                }
            }
        }

        // Free the allocated memory for the buffer
        if (chunk.memory) {
            free(chunk.memory);
        }
    }

    return alarmTimes;
}

enum AlarmState {
    RINGING,
    SNOOZING,
    IDLE
};

static std::mutex alarmMutex;
std::condition_variable queue_cv;
static bool run = true;
static std::set<time_t> alarms;
static AlarmState alarm_state = IDLE;
static time_t snoozeUntil = 0;

static std::queue<std::string> alarmCommandQueue;
static bool input_snooze = false;
static bool input_shut = false;
static audio_player *ringer;

void alarm_sound_thread() {
    while (run) {
        alarmMutex.lock();
        bool trigger_alarm = false;
        std::vector<time_t> to_remove;
        time_t cur_time = time(nullptr);
        switch (alarm_state) {
            case IDLE:
                for (time_t alarm : alarms) {
                    if (alarm < cur_time) {
                        trigger_alarm = true;
                        to_remove.push_back(alarm);
                    }
                }
                for (time_t alarm : to_remove) {
                    alarms.erase(alarm);
                }
                if (trigger_alarm) {
                    alarm_state = RINGING;
                }
                break;
            case SNOOZING:
                for (time_t alarm : alarms) {
                    if (alarm < cur_time) {
                        trigger_alarm = true;
                        to_remove.push_back(alarm);
                    }
                }
                for (time_t alarm : to_remove) {
                    alarms.erase(alarm);
                }
                if (trigger_alarm || cur_time > snoozeUntil) {
                    alarm_state = RINGING;
                }
                break;
            case RINGING:
                if (ringer == nullptr) {
                    ringer = startRinging("sound.wav");
                }

                for (time_t alarm : alarms) {
                    if (alarm < cur_time) {
                        to_remove.push_back(alarm);
                    }
                }
                for (time_t alarm : to_remove) {
                    alarms.erase(alarm);
                }

                if (input_snooze) {
                    alarm_state = SNOOZING;
                    input_snooze = false;
                    snoozeUntil = time(nullptr) + Alarm::SNOOZE_TIME_SECONDS;
                    delete ringer;
                    ringer = nullptr;
                }
                if (input_shut) {
                    alarm_state = IDLE;
                    input_shut = false;
                    delete ringer;
                    ringer = nullptr;
                }

                break;
        }
        alarmMutex.unlock();

        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }
}

void alarm_populate_thread() {
    while (run) {
        auto new_alarms = get_alarms("http://155.138.197.46:3002", "test", "test");
        alarmMutex.lock();
        time_t cur_time = time(nullptr);
        for (time_t alarm : new_alarms) {
            if (cur_time < alarm) {
                alarms.insert(alarm);
                std::cout << alarm << " ";
            }
        }
        std::cout << std::endl;
        alarmMutex.unlock();
        std::this_thread::sleep_for(std::chrono::milliseconds(1000));
    }
}

void alarm_command_thread() {
    bool command_issued = false;
    while (run) {
        alarmMutex.lock();

        if (alarmCommandQueue.size() <= 0) {
            alarmMutex.unlock();
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
            continue;
        }

        std::string command = alarmCommandQueue.front();
        alarmCommandQueue.pop();

        if (command == "snooze") {
            input_snooze = true;
        } else if (command == "shut") {
            input_shut = true;
        }

        alarmMutex.unlock();
    }
}

// Forward declaration for the `start_accept` function
class server;

// --- Session Class for Each Client Connection ---
// This class manages the lifecycle of a single client connection,
// implementing the "handler method per-connection" logic.
class session : public std::enable_shared_from_this<session> {
public:
    session(boost::asio::io_context& io_context)
    : socket_(io_context),
    strand_(io_context) // Use a strand for this session's handlers/74
    {
        //std::cout << "Daemon: New session created. (Address: " << socket_.remote_endpoint().address() << ":" << socket_.remote_endpoint().port() << ")" << std::endl;
    }

    // Destructor to report session end
    ~session() {
        if (socket_.is_open()) {
            socket_.close();
        }
        std::cout << "Daemon: Session destroyed." << std::endl;
    }

    boost::asio::ip::tcp::socket& socket() {
        return socket_;
    }

    // Start the session's asynchronous operations
    void start() {
        // Asynchronously read data until a newline character
        // The handler (`handle_read`) will be executed on this session's strand,
        // ensuring serial access to session data.
        boost::asio::async_read_until(socket_, buffer_, '\n',
                                      boost::asio::bind_executor(strand_,
                                                                 std::bind(&session::handle_read, shared_from_this(),
                                                                           std::placeholders::_1, std::placeholders::_2)));
    }

private:
    // Callback for when an asynchronous read operation completes
    void handle_read(const boost::system::error_code& error, size_t bytes_transferred) {
        if (!error) {
            std::istream is(&buffer_);
            std::string message;
            std::getline(is, message); // Extract the command/message

            std::cout << "Daemon (" << this << " addr " << socket_.remote_endpoint().address() << "): Received: '" << message << "'" << std::endl;

            // --- Command Decoupling ---
            // Instead of echoing directly, push the command to a shared queue.
            // A separate command processor thread (or pool) will handle `message`.
            {
                std::lock_guard<std::mutex> lock(alarmMutex);
                alarmCommandQueue.push(message); // Or a more complex `Command` struct
                // In a real application, you might use a unique ID for this session
                // and pass it along with the command, so the processor can send
                // the response back to this specific session.
            }
            queue_cv.notify_one(); // Signal the command processor thread(s)

            // For this echo example, we'll still reply directly from the I/O thread
            // with a simple echo response. If you were truly decoupling, the response
            // would be sent back here via `io_context.post` from the command worker.
            std::string reply = "Echo: " + message + "\n";

            // Asynchronously write the reply back to the client
            boost::asio::async_write(socket_, boost::asio::buffer(reply),
                                     boost::asio::bind_executor(strand_,
                                                                std::bind(&session::handle_write, shared_from_this(), // Keep session alive
                                                                          std::placeholders::_1, std::placeholders::_2)));

        } else if (error == boost::asio::error::eof) {
            std::cout << "Daemon (" << this << "): Client disconnected gracefully." << std::endl;
        } else {
            std::cerr << "Daemon (" << this << "): Read error: " << error.message() << std::endl;
        }
        // If there was an error or client disconnected, the session will eventually be cleaned up
        // when shared_ptr count drops to zero.
    }

    // Callback for when an asynchronous write operation completes
    void handle_write(const boost::system::error_code& error, size_t bytes_transferred) {
        if (!error) {
            std::cout << "Daemon (" << this << "): Replied to client." << std::endl;

            // After writing the response, we expect more commands from the client.
            // So, initiate another asynchronous read operation for this session.
            boost::asio::async_read_until(socket_, buffer_, '\n',
                                          boost::asio::bind_executor(strand_,
                                                                     std::bind(&session::handle_read, shared_from_this(),
                                                                               std::placeholders::_1, std::placeholders::_2)));
        } else {
            std::cerr << "Daemon (" << this << "): Write error: " << error.message() << std::endl;
            // On write errors, it's often best to close the connection.
            socket_.close();
        }
    }

    boost::asio::ip::tcp::socket socket_; // Socket for this connection
    boost::asio::streambuf buffer_;       // Buffer for reading incoming data
    boost::asio::io_context::strand strand_; // Ensures handlers for THIS session run serially
};


// --- Server Class to Manage Acceptor ---
// This class manages the server's acceptor, which listens for new client connections.
class server {
private:
    boost::asio::io_context& io_context_;       // The I/O service
    boost::asio::ip::tcp::acceptor acceptor_; // Listens for connections


public:
    server(boost::asio::io_context& io_context_param, const std::string& address_str, unsigned short port)
    : io_context_(io_context_param),
    acceptor_(io_context_param) {
        boost::asio::ip::tcp::endpoint endpoint(boost::asio::ip::make_address(address_str), port);
        acceptor_.open(endpoint.protocol());
        acceptor_.set_option(boost::asio::ip::tcp::acceptor::reuse_address(true));
        acceptor_.bind(endpoint);
        acceptor_.listen();

        // Start accepting the first client connection
        start_accept();
    }

    // This is important: The destructor will be called when the server object
    // goes out of scope, unbinding the port.
    ~server() {
        std::cout << "Daemon: Server acceptor stopped." << std::endl;
    }

private:
    // Initiates an asynchronous accept operation
    void start_accept() {
        // Create a new session object for the upcoming connection.
        // It's held by a shared_ptr, ensuring its lifetime extends
        // until all async operations involving it are complete.
        auto new_session = std::make_shared<session>(io_context_);

        // Asynchronously accept a new connection.
        // When a connection is established, `handle_accept` is called.
        acceptor_.async_accept(new_session->socket(),
                               std::bind(&server::handle_accept, this, new_session,
                                         std::placeholders::_1));
    }

    // Callback for when an asynchronous accept operation completes
    void handle_accept(std::shared_ptr<session> new_session,
                       const boost::system::error_code& error) {
        if (!error) {
            // Connection successful! Start the session's operations (reading commands).
            new_session->start();
        } else {
            std::cerr << "Daemon: Accept error: " << error.message() << std::endl;
        }

        // Always initiate another accept operation to listen for the next client.
        // This makes the server continuously ready for new connections.
        start_accept();
    }

};

int main(int argc, char **argv) {
    // Seed initial value with valid alarms
    alarms = get_alarms("http://prosweet.gay", "test", "test");
    time_t currentTime = time(nullptr);
    std::set<time_t> *to_erase = new std::set<time_t>();
    for (time_t time : alarms) {
        if (time <= currentTime) {
            to_erase->insert(time);
        }
    }
    for (time_t time : *to_erase) {
        alarms.erase(time);
    }
    delete to_erase;

    // Start main alarm/ring loop separately from the command handling loop
    std::cout << "Alarmd: Starting TCP daemon (multi-client async)..." << std::endl;

    try {
        boost::asio::io_context io_context;

        // Create and start the server, listening on the specified port
        server s(io_context, Alarm::DEFAULT_BINDING_ADDRESS, Alarm::DEFAULT_BINDING_PORT);

        std::cout << "Alarmd: Listening on " << Alarm::DEFAULT_BINDING_ADDRESS << ":" << Alarm::DEFAULT_BINDING_PORT << std::endl;

        // Start the command processing thread.
        std::thread processor_thread(alarm_command_thread);
        std::thread sound_thread(alarm_sound_thread);
        std::thread populate_thread(alarm_populate_thread);

        // --- I/O Thread Pool (for true concurrency) ---
        // You can run io_context::run() on multiple threads to utilize
        // multi-core processors for I/O operations.
        std::vector<std::thread> io_threads;
        size_t num_io_threads = std::thread::hardware_concurrency(); // Or a fixed number
        if (num_io_threads == 0) num_io_threads = 1; // Always at least one thread

        for (size_t i = 0; i < num_io_threads; ++i) {
            io_threads.emplace_back([&io_context]() {
                io_context.run();
            });
        }
        std::cout << "Alarmd: Running I/O on " << num_io_threads << " threads." << std::endl;

        // In a real daemon, you'd also need signal handling (SIGTERM, SIGINT)
        // to gracefully stop io_context and join threads.
        // For this example, CTRL+C will eventually cause crash/exit.

        // Wait for all I/O threads to finish (which they won't until io_context is stopped)
        for (auto& t : io_threads) {
            t.join();
        }

        // Signal command processor thread to stop
        run = false;
        queue_cv.notify_all(); // Wake up worker if it's waiting
        if (processor_thread.joinable()) processor_thread.join();
        if (sound_thread.joinable()) sound_thread.join();
        if (populate_thread.joinable()) populate_thread.join();

    } catch (const boost::system::system_error& ex) {
        std::cerr << "Alarmd: System error: " << ex.what() << std::endl;
    } catch (const std::exception& ex) {
        std::cerr << "Alarmd: General error: " << ex.what() << std::endl;
    }

    std::cout << "Alarmd: Daemon stopped gracefully." << std::endl; // This might not print if killed by Ctrl+C directly
    return 0;
}
