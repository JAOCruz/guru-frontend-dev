#!/bin/sh
# Frames from capture.cjs → the scroll-scrubbed videos + posters in public/video.
# Keyframe every 8 frames so seeking backwards stays smooth.
# Usage: sh tools/delivery-video/encode.sh <desktopFramesDir> <mobileFramesDir>
set -e
OUT="$(dirname "$0")/../../public/video"
mkdir -p "$OUT"
enc() { # frames size name
  ffmpeg -v error -y -framerate 30 -i "$1/f%04d.png" -vf "scale=$2:flags=lanczos" -c:v libx264 -preset slow -crf 29 \
    -g 8 -keyint_min 8 -sc_threshold 0 -pix_fmt yuv420p -movflags +faststart -an "$OUT/$3.mp4"
  first=$(ls "$1" | head -1); last=$(ls "$1" | tail -1)
  w=${2%x*}; h=${2#*x}
  python3 -c "import sys; from PIL import Image; Image.open(sys.argv[1]).convert('RGB').resize((int(sys.argv[3]), int(sys.argv[4])), Image.LANCZOS).save(sys.argv[2], 'WEBP', quality=72)" "$1/$first" "$OUT/$3-start.webp" $w $h
  python3 -c "import sys; from PIL import Image; Image.open(sys.argv[1]).convert('RGB').resize((int(sys.argv[3]), int(sys.argv[4])), Image.LANCZOS).save(sys.argv[2], 'WEBP', quality=72)" "$1/$last" "$OUT/$3-end.webp" $w $h
}
enc "$1" 1120x630 delivery-desktop
enc "$2" 540x960 delivery-mobile
ls -la "$OUT"
