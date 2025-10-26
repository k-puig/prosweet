cmake_minimum_required(VERSION 3.10)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

project(alarmsweet)

add_executable(alarmd alarmd.cpp miniaudio/miniaudio.c)
add_executable(alarmctl alarmctl.cpp)

find_package(PkgConfig REQUIRED)
pkg_search_module(PULSEAUDIO REQUIRED libpulse)
pkg_search_module(ALSA REQUIRED alsa)

find_package(Boost 1.70 COMPONENTS system thread REQUIRED)
find_package(Threads)

install(TARGETS alarmd RUNTIME DESTINATION bin)
target_link_libraries(alarmd Boost::system Boost::thread Threads::Threads m ${PULSEAUDIO_LIBRARIES} ${ALSA_LIBRARIES})
target_include_directories(alarmd PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/miniaudio)

install(TARGETS alarmctl RUNTIME DESTINATION bin)
target_link_libraries(alarmctl Boost::system Boost::thread)
