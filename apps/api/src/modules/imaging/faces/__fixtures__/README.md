`astronaut-256.png`: astronaut Eileen Collins, NASA (public domain), as shipped
with scikit-image (`skimage.data.astronaut()`), downscaled to 256x256 with
OpenCV `INTER_AREA`. On this image's grayscale pixels, OpenCV 4.10's
`CascadeClassifier('haarcascade_frontalface_alt2.xml').detectMultiScale(gray,
1.1, 3)` returns `[[88, 33, 49, 49], [142, 63, 64, 64]]` (the second is a
false positive on the suit) - `haar-cascade.spec.ts` checks the port against it.
