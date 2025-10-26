#include "alarm/defaults.hpp"

#include <boost/asio.hpp>
#include <ncurses.h>
#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <chrono>
#include <thread>
#include <ctime>
#include <iomanip>
#include <sstream>

// --- ASCII Art Data ---
// A map to hold the ASCII art for each character. The art is 7 rows high.
std::map<char, std::vector<std::string>> ascii_digits;

/**
 * @brief Initializes the map with ASCII art for digits 0-9 and the colon.
 */
void initialize_ascii_digits() {
    ascii_digits['0'] = {
        "  #####  ",
        " #     # ",
        "#       #",
        "#       #",
        "#       #",
        " #     # ",
        "  #####  "
    };
    ascii_digits['1'] = {
        "   ##    ",
        "  ###    ",
        "   ##    ",
        "   ##    ",
        "   ##    ",
        "   ##    ",
        " ######  "
    };
    ascii_digits['2'] = {
        "  #####  ",
        " #     # ",
        "       # ",
        "  #####  ",
        " #       ",
        " #       ",
        " ####### "
    };
    ascii_digits['3'] = {
        "  #####  ",
        " #     # ",
        "       # ",
        "  ###### ",
        "       # ",
        " #     # ",
        "  #####  "
    };
    ascii_digits['4'] = {
        " #       ",
        " #    #  ",
        " #    #  ",
        " #    #  ",
        " ####### ",
        "      #  ",
        "      #  "
    };
    ascii_digits['5'] = {
        " ####### ",
        " #       ",
        " #       ",
        " ######  ",
        "       # ",
        " #     # ",
        "  #####  "
    };
    ascii_digits['6'] = {
        "  #####  ",
        " #     # ",
        " #       ",
        " ######  ",
        " #     # ",
        " #     # ",
        "  #####  "
    };
    ascii_digits['7'] = {
        " ####### ",
        " #    ## ",
        "    ##   ",
        "   ##    ",
        "  ##     ",
        "  ##     ",
        "  ##     "
    };
    ascii_digits['8'] = {
        "  #####  ",
        " #     # ",
        " #     # ",
        "  #####  ",
        " #     # ",
        " #     # ",
        "  #####  "
    };
    ascii_digits['9'] = {
        "  #####  ",
        " #     # ",
        " #     # ",
        "  ###### ",
        "       # ",
        " #     # ",
        "  #####  "
    };
    ascii_digits[':'] = {
        "         ",
        "   ##    ",
        "   ##    ",
        "         ",
        "   ##    ",
        "   ##    ",
        "         "
    };
}


/**
 * @brief Sends a command string to the alarm daemon.
 * Connects, sends the command followed by a newline, and disconnects.
 * @param command The command to send (e.g., "snooze", "shut").
 * @param status_y The y-coordinate to display status/error messages.
 */
void sendCommand(const std::string& command, int status_y) {
    try {
        boost::asio::io_context io_context;
        boost::asio::ip::tcp::socket socket(io_context);
        boost::asio::ip::tcp::resolver resolver(io_context);

        boost::asio::connect(socket, resolver.resolve(Alarm::DEFAULT_BINDING_ADDRESS, std::to_string(Alarm::DEFAULT_BINDING_PORT)));

        std::string message = command + "\n";
        boost::asio::write(socket, boost::asio::buffer(message));
        socket.close();

        // Display success message
        attron(COLOR_PAIR(1));
        mvprintw(status_y, 1, "Sent command: %-20s", command.c_str());
        attroff(COLOR_PAIR(1));

    } catch (const std::exception& e) {
        // Display error message on screen
        attron(COLOR_PAIR(3) | A_BOLD);
        std::string err_msg = "Error: Could not connect to daemon. Is it running?";
        mvprintw(status_y, 1, "%-60s", err_msg.c_str());
        attroff(COLOR_PAIR(3) | A_BOLD);
    }
}

/**
 * @brief Draws the current time on the screen using ASCII art.
 * @param start_y The starting row.
 * @param start_x The starting column.
 */
void drawAsciiTime(int start_y, int start_x) {
    // Get current time and format it as HH:MM:SS
    auto now = std::chrono::system_clock::now();
    auto in_time_t = std::chrono::system_clock::to_time_t(now);
    std::tm buf;
    localtime_r(&in_time_t, &buf); // Thread-safe localtime
    std::stringstream ss;
    ss << std::put_time(&buf, "%H:%M:%S");
    std::string time_str = ss.str();

    const int char_height = 7;
    attron(COLOR_PAIR(1) | A_BOLD);

    // Iterate through each row of the ASCII art
    for (int i = 0; i < char_height; ++i) {
        std::string line_buffer;
        // Iterate through each character of the time string (e.g., '1', '4', ':', ...)
        for (char c : time_str) {
            if (ascii_digits.count(c)) {
                line_buffer += ascii_digits[c][i];
                line_buffer += " "; // Add space between characters
            }
        }
        mvprintw(start_y + i, start_x, "%s", line_buffer.c_str());
    }
    attroff(COLOR_PAIR(1) | A_BOLD);
}


int main(int argc, char **argv) {
    initialize_ascii_digits();

    // --- ncurses Initialization ---
    initscr();            // Start curses mode
    cbreak();             // Disable line buffering, pass everything
    noecho();             // Don't echo() while we do getch
    curs_set(0);          // Hide the cursor
    nodelay(stdscr, TRUE); // Make getch() non-blocking
    keypad(stdscr, TRUE); // Enable function keys (like F1, arrow keys, and numpad)

    // Enable colors
    start_color();
    init_pair(1, COLOR_CYAN, COLOR_BLACK);   // For the clock
    init_pair(2, COLOR_WHITE, COLOR_BLACK);  // For instructions
    init_pair(3, COLOR_RED, COLOR_BLACK);    // For errors

    bool running = true;
    while(running) {
        int max_y, max_x;
        getmaxyx(stdscr, max_y, max_x);

        // --- Input Handling ---
        int ch = getch();
        int status_line = max_y - 4;

        if (ch != ERR) {
            // Clear previous status message before handling new input
            move(status_line, 0);
            clrtoeol();
        }

        switch(ch) {
            case 'q':
            case 'Q':
                running = false;
                break;

                // NOTE on Numpad keys: The character codes sent by numpad keys
                // can vary based on terminal and NumLock state.
                // '0' and '.' are common when NumLock is OFF.
                // If these don't work, you may need to find the specific key code
                // for your system (e.g., by printing the value of `ch`).
            case '0':
                sendCommand("snooze", status_line);
                break;
            case '.':
                sendCommand("shut", status_line);
                break;

            case ERR: // No input, do nothing
            default:
                break;
        }

        // --- Drawing ---
        erase();

        int clock_start_x = (max_x - (8 * 10)) / 2; // Center the clock (8 chars wide, 10 chars spacing)
        int clock_start_y = (max_y - 12) / 2; // Center vertically
        if (clock_start_x < 1) clock_start_x = 1;
        if (clock_start_y < 1) clock_start_y = 1;

        drawAsciiTime(clock_start_y, clock_start_x);

        // Draw instructions at the bottom
        attron(COLOR_PAIR(2));
        const char *instructions = "Press Numpad [0] to Snooze  |  Numpad [.] to Shut Off  |  [q] to Quit";
        mvprintw(max_y - 2, (max_x - strlen(instructions)) / 2, "%s", instructions);

        const char* note = "(Check NumLock if keys aren't working)";
        mvprintw(max_y - 1, (max_x - strlen(note)) / 2, "%s", note);
        attroff(COLOR_PAIR(2));

        refresh();

        // Sleep to prevent 100% CPU usage
        std::this_thread::sleep_for(std::chrono::milliseconds(50));
    }

    // --- Cleanup ---
    endwin(); // End curses mode

    return 0;
}
