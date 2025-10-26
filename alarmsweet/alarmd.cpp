#include "miniaudio/miniaudio.h"

#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <memory>

class audio_player {
public:
    audio_player(ma_device *device, ma_device_config *deviceConfig, ma_decoder *decoder) {
        this->device = device;
        this->deviceConfig = deviceConfig;
        this->decoder = decoder;
    }
    ~audio_player() {
        free(this->decoder);
        free(this->deviceConfig);
        free(this->device);
    }
    ma_decoder *decoder;
    ma_device_config *deviceConfig;
    ma_device *device;


};

void unload_player(audio_player *player) {
    ma_device_uninit(player->device);
    ma_decoder_uninit(player->decoder);
}

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


std::shared_ptr<audio_player> startRinging(const char *filePath) {
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

    return std::make_shared<audio_player>(device, deviceConfig, decoder);
}

int main(int argc, char **argv) {
    while (true) {
        std::vector<std::shared_ptr<audio_player>> players;
        auto ringer = startRinging("sound.wav");
        players.push_back(ringer);

        printf("Press Enter to quit...");
        getchar();

        unload_player(players[0].get());
    }
    return 0;
}
