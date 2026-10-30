#!/bin/bash
printf '\033[97;44m Dev mode : nested Gnome session ✓✓ \033[0m\n\n'

UUID="zclock@lorens"

dbus-run-session -- bash -c '
  gnome-shell --devkit --wayland &
  shell_pid=$!

  # wait until the nested shell owns org.gnome.Shell.Extensions
  for i in $(seq 1 60); do
    gdbus call --session --dest org.freedesktop.DBus \
      --object-path /org/freedesktop/DBus \
      --method org.freedesktop.DBus.NameHasOwner org.gnome.Shell.Extensions \
      | grep -q true && break
    sleep 0.5
  done

  gnome-extensions enable '"$UUID"' && echo ">>> $UUID enabled in nested session"
  wait $shell_pid
' 2>&1 | grep --line-buffered "zclock\|>>>"