#!/bin/bash
dbus-run-session gnome-shell --devkit --wayland 2>&1 | grep  --line-buffered "gclock"