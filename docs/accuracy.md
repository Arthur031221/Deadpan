# Head height accuracy, United States passport

For each photo Deadpan picks the crop that would make the head 30 mm (the middle of 25 to 35 mm). It never pads a picture, so a photo cropped too tightly for that gets the largest crop it can hold and its head reads larger. The hand marked chin and crown points give a second head height for the same crop. The two verdicts, inside the window or not, are compared.

- The verdicts agree on 29 of 30 photos (0 declined)
- 20 of the 20 photos Deadpan passes are inside the window by hand measurement, and 10 photos are too tight for this photo size
- median absolute error 1.0 mm, worst 2.5 mm, mean signed error 0.8 mm (positive means Deadpan reads the head larger than the hand points)
- crown error 0.3 percent of head height, chin error 2.7 percent (medians)

| photo | Deadpan mm | by hand mm | error mm | crown err % | chin err % | Deadpan | by hand |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 00.jpg | 30.0 | 27.6 | 2.4 | -0.7 | 8.1 | pass | pass |
| 01.jpg | 31.4 | 29.3 | 2.1 | -0.6 | 6.6 | pass | pass |
| 02.jpg | 37.4 | 35.8 | 1.6 | 0.3 | 4.8 | fail | fail |
| 03.jpg | 30.0 | 28.3 | 1.7 | 0.2 | 6.3 | pass | pass |
| 04.jpg | 30.0 | 28.6 | 1.4 | -2.0 | 2.7 | pass | pass |
| 05.jpg | 30.0 | 27.5 | 2.5 | -1.3 | 7.8 | pass | pass |
| 06.jpg | 30.0 | 30.3 | -0.3 | -0.2 | -1.3 | pass | pass |
| 07.jpg | 30.0 | 30.3 | -0.3 | 1.2 | 0.3 | pass | pass |
| 08.jpg | 39.1 | 37.2 | 1.9 | -0.7 | 4.5 | fail | fail |
| 09.jpg | 30.0 | 28.6 | 1.4 | -0.5 | 4.5 | pass | pass |
| 10.jpg | 38.2 | 37.6 | 0.6 | -0.2 | 1.5 | fail | fail |
| 11.jpg | 32.9 | 31.9 | 1.0 | -0.1 | 3.1 | pass | pass |
| 12.jpg | 35.2 | 34.5 | 0.7 | -0.4 | 1.6 | fail | pass |
| 13.jpg | 31.4 | 30.9 | 0.4 | -0.5 | 0.9 | pass | pass |
| 14.jpg | 30.0 | 30.0 | -0.0 | -0.9 | -0.9 | pass | pass |
| 15.jpg | 30.0 | 28.5 | 1.5 | -0.8 | 4.4 | pass | pass |
| 16.jpg | 33.4 | 32.9 | 0.4 | -0.2 | 1.2 | pass | pass |
| 17.jpg | 32.1 | 30.5 | 1.6 | -2.6 | 2.7 | pass | pass |
| 18.jpg | 30.5 | 30.4 | 0.1 | -0.2 | -0.0 | pass | pass |
| 19.jpg | 30.0 | 29.3 | 0.7 | -0.3 | 2.0 | pass | pass |
| 20.jpg | 41.9 | 40.9 | 1.0 | -1.1 | 1.3 | fail | fail |
| 21.jpg | 30.0 | 29.2 | 0.8 | 0.2 | 3.1 | pass | pass |
| 22.jpg | 37.4 | 37.2 | 0.2 | -0.2 | 0.3 | fail | fail |
| 23.jpg | 37.8 | 40.0 | -2.2 | -0.0 | -5.5 | fail | fail |
| 24.jpg | 41.1 | 38.8 | 2.3 | -0.3 | 5.5 | fail | fail |
| 25.jpg | 39.5 | 38.7 | 0.8 | 0.3 | 2.4 | fail | fail |
| 26.jpg | 30.0 | 29.2 | 0.8 | -0.3 | 2.3 | pass | pass |
| 27.jpg | 30.0 | 29.2 | 0.8 | -0.5 | 2.4 | pass | pass |
| 28.jpg | 42.6 | 44.2 | -1.6 | -0.3 | -3.9 | fail | fail |
| 29.jpg | 30.0 | 29.3 | 0.7 | -0.2 | 2.2 | pass | pass |
