#!/bin/bash
# Patch the Electron binary so the dock shows "Claude Workshop" with our icon
DIST="node_modules/electron/dist"
NEW_APP="$DIST/Claude Workshop.app"
PATH_TXT="node_modules/electron/path.txt"

# Rename any previous name → Claude Workshop.app
for PREV in "$DIST/Electron.app" "$DIST/Consulate.app" "$DIST/cmux.app" "$DIST/Tavern.app" "$DIST/Claude Code.app"; do
  if [ -d "$PREV" ] && [ ! -d "$NEW_APP" ]; then
    mv "$PREV" "$NEW_APP"
  fi
done

APP="$NEW_APP"
PLIST="$APP/Contents/Info.plist"
ICNS_SRC="assets/icon.icns"
ICNS_DST="$APP/Contents/Resources/electron.icns"

if [ -f "$PATH_TXT" ]; then
  printf 'Claude Workshop.app/Contents/MacOS/Electron' > "$PATH_TXT"
fi

if [ -f "$PLIST" ]; then
  /usr/libexec/PlistBuddy \
    -c "Set :CFBundleName 'Claude Workshop'" \
    -c "Set :CFBundleDisplayName 'Claude Workshop'" \
    "$PLIST" 2>/dev/null

  /usr/libexec/PlistBuddy \
    -c "Add :CFBundleDisplayName string 'Claude Workshop'" \
    "$PLIST" 2>/dev/null
fi

EN_LPROJ="$APP/Contents/Resources/en.lproj"
mkdir -p "$EN_LPROJ"
printf '"CFBundleDisplayName" = "Claude Workshop";\n"CFBundleName" = "Claude Workshop";\n' > "$EN_LPROJ/InfoPlist.strings"

if [ -f "$ICNS_SRC" ] && [ -f "$ICNS_DST" ]; then
  cp "$ICNS_SRC" "$ICNS_DST"
fi

/usr/bin/touch "$APP" 2>/dev/null

exit 0
