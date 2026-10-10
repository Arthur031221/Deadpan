# Where each number comes from

Read on 2026-10-10. Deadpan quotes the issuing authority and says where a number is its own choice.

| Preset                       | Numbers                                                                                              | Source                                                  | How it was read                                                                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| United States passport       | 2 x 2 in (51 x 51 mm), head 1 to 1 3/8 in (25 to 35 mm), neutral expression, eyes open, mouth closed | travel.state.gov, U.S. Passport Photos                  | The live page sits behind a bot check, so the text was read from the Internet Archive snapshot of the same URL (2025) and matched against the search listing of the page |
| United States visa (digital) | square JPEG, 600 to 1200 px, at most 240 KB, head 50 to 69 percent of the image height               | travel.state.gov, Digital Image Requirements            | Search listing of the page. The passport page has no pixel limits, so this preset is separate                                                                            |
| Taiwan passport              | 35 x 45 mm, head 32 to 36 mm, centered, neutral with the mouth closed, plain white background        | boca.gov.tw, Passport Photos                            | Read in a browser                                                                                                                                                        |
| Schengen visa                | 35 x 45 mm, at least 13 mm from the eyes to the bottom of the chin                                   | Czech Ministry of Foreign Affairs, Visa Code Article 13 | Read in a browser. The page gives no head height. The 32 to 36 mm range is the ICAO figure that the BOCA page states                                                     |

Left out on purpose:

- Canada says the photo must be taken by a commercial photographer and rejects edited photos. A home print would not be accepted.
- The United Kingdom, Japan and India publish their rules on pages that block automated reading or give no head height in millimetres. They are planned once someone can check the page by eye.

## Deadpan's own tolerances

These are not in any spec. They are marked `Guide` in the page.

| Rule                    | Limit                                                                      | Why                                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Head centered           | within 6 percent of the photo width                                        | The specs say centered without a number                                                                                         |
| Whole head in the photo | at least 1 mm of room above the crown and below the chin                   | Hair or chin must not touch the edge                                                                                            |
| Head level              | roll within 4 degrees (angle of the line through the pupils)               | The specs say the head must not tilt                                                                                            |
| Facing the camera       | yaw within 8 degrees, pitch within 8 degrees of level                      | ISO 19794-5 suggests 5 degrees for roll, yaw and pitch. Deadpan is looser because the pose estimate is itself a few degrees off |
| Neutral, mouth closed   | smile score at most 0.25 and jaw open at most 0.12 (MediaPipe blendshapes) | Stricter than the State Department, which allows a closed mouth smile                                                           |
| Eyes open               | blink score at most 0.5                                                    |                                                                                                                                 |
| Enough pixels           | at least 300 dpi at the printed size                                       | A 2 inch photo needs 600 px, the State Department's digital minimum                                                             |
