#!/bin/sh
# Frames from capture.cjs (rendered 1.5× for supersampling) → the scroll-scrubbed videos in public/video:
# AV1 (Chrome, Android, new iPhones), HEVC (Safari / iPhone) and H.264 (fallback), plus the
# first/last frame as posters. Each video also gets a reversed copy (-rev) so scrolling up plays
# backwards smoothly instead of seeking. Keyframe every 8 frames so the occasional seek stays quick.
# Usage: sh tools/delivery-video/encode.sh <desktopFramesDir> <mobileFramesDir>
set -e
OUT="$(dirname "$0")/../../public/video"
mkdir -p "$OUT"
rm -f "$OUT"/delivery-*
codecs() { # input filter out
  ffmpeg -v error -y -framerate 30 -i "$1" -vf "$2" -c:v libsvtav1 -preset 4 -crf 36 -g 8 -svtav1-params "log-level=0" \
    -pix_fmt yuv420p -movflags +faststart -an "$3-av1.mp4"
  ffmpeg -v error -y -framerate 30 -i "$1" -vf "$2" -c:v libx265 -preset slow -crf 27 \
    -x265-params "keyint=8:min-keyint=8:scenecut=0:log-level=error" -tag:v hvc1 -pix_fmt yuv420p -movflags +faststart -an "$3-hevc.mp4"
  ffmpeg -v error -y -framerate 30 -i "$1" -vf "$2" -c:v libx264 -preset slow -crf 25 -g 8 -keyint_min 8 -sc_threshold 0 \
    -pix_fmt yuv420p -movflags +faststart -an "$3-h264.mp4"
}
enc() { # frames size name
  in="$1/f%04d.png"; vf="scale=$2:flags=lanczos"
  codecs "$in" "$vf" "$OUT/$3"
  codecs "$in" "$vf,reverse" "$OUT/$3-rev"
  w=${2%x*}; h=${2#*x}
  for f in "$(ls "$1" | head -1):start" "$(ls "$1" | tail -1):end"; do
    python3 -c "import sys; from PIL import Image; Image.open(sys.argv[1]).convert('RGB').resize((int(sys.argv[3]), int(sys.argv[4])), Image.LANCZOS).save(sys.argv[2], 'WEBP', quality=80, method=6)" \
      "$1/${f%%:*}" "$OUT/$3-${f#*:}.webp" $w $h
  done
}
enc "$1" 1920x1080 delivery-desktop
enc "$2" 1080x1920 delivery-mobile
ls -la "$OUT"
