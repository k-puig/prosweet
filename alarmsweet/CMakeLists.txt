cmake_minimum_required(VERSION 3.10)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

project(alarmsweet)

add_executable(alarmd alarmd.cpp miniaudio/miniaudio.c base64/base64.cpp alarm/defaults.cpp)
add_executable(alarmctl alarmctl.cpp alarm/defaults.cpp)

find_package(PkgConfig)
pkg_search_module(PULSEAUDIO libpulse)
pkg_search_module(ALSA alsa)

find_package(Boost 1.70 COMPONENTS system thread REQUIRED)
find_package(Threads)

install(TARGETS alarmd RUNTIME DESTINATION bin)
target_link_libraries(alarmd Boost::system Boost::thread Threads::Threads m ${PULSEAUDIO_LIBRARIES} ${ALSA_LIBRARIES} curl)
target_include_directories(alarmd PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/miniaudio)

install(TARGETS alarmctl RUNTIME DESTINATION bin)
target_link_libraries(alarmctl Boost::system Boost::thread ncurses)
