THANE CIVIC AMENITIES DATASET

DATASET SCOPE
13 source PDFs, 13 facilities and 64 photos. Five washrooms, three water facilities and five parks/grounds.

HOW TO USE THE CSV
Thane_facilities.csv is the only CSV. One row per facility; filter category to select Washrooms, Water Facilities or Parks. CSV does not support worksheet tabs.

HOW TO USE THIS WORKBOOK
The three category sheets contain separate filterable tables. Photo register contains one row per image. Scroll right for photo paths, printed addresses and review notes.

SOURCE OF FACTS
Photos and visible GPS stamps in the supplied PDFs only. No web lookup or independent field verification has been performed. source_pdf and geotag_source_page identify the evidence.

PERMANENT IDS
THN-WC-001 to 005; THN-WAT-001 to 003; THN-PARK-001 to 005. Washroom 4 and 5 retain their demo IDs. Demo records are included once, not appended again.

NAMES
name_source identifies names transliterated from readable signs versus descriptive location labels. Local script is retained where readable. These are not independently verified official registry names.

COORDINATES
Latitude and longitude copied from visible GPS stamps. Decimal degrees are preserved. location_source is photo_stamp, not EXIF. location_confirmed=no until the actual entrance pin is checked.

DATES
geotag_captured_at is the stamped image time, in ISO 8601 with +05:30. Dates are read as DD/MM/YYYY. Normal-photo times are left blank in Photo register. Stamped times are not assessment dates.

UNKNOWN VALUES
Blank means unknown, not zero or no. Ward and verified_at are blank. All field_status values are unverified. No CAAUI, water quality, fees, opening hours or service functionality is invented.

CITY DISCREPANCIES
Dataset city is Thane. stamp_city and address_from_stamp preserve original printed labels. Washroom 2 says Navi Mumbai; Washroom 4 and Water 3 say Mumbai. Confirm those addresses and pins.

ADDRESS LIMITATIONS
A phone geocoder may print a nearby building, floor, society or landmark. Such text is preserved, not assumed to be the facility postal address. Review notes explain specific issues.

PARKS VERSUS GROUNDS
Park 3 and Park 5 show playing grounds. They remain in the requested Parks category, with amenity_subtype=sports_ground. No boundary polygons or site area are inferred.

PHOTOS AND PATHS
Keep photos/ beside the CSV and workbook. Paths are relative to this dataset folder. photo_01_path through photo_05_path follow PDF page order; the fifth path is blank for Washroom 4.

COVER AND GEOTAG PHOTOS
cover_photo_path points to a normal facility view. geotag_photo_path points to location evidence. Park 1 has its geotag on page 4; its cover is page 5. Depot context imagery is retained but not selected as Water 2 cover.

IMAGE PROVENANCE
JPEGs are renders of complete PDF pages, not original camera files. They retain visible stamps but do not preserve camera EXIF. Original PDFs and camera photos should be retained as master evidence.

OBSERVED VERSUS VERIFIED
photo_observations describe visible features only. Ramp presence does not establish accessible dimensions; taps do not prove water availability or potability; people using a space do not establish current opening hours.

ADDING NEW DATA
Add a unique facility row and its photos folder. Add a Photo register row per new image. Update photo_count and path fields. If more than five photos are needed, extend photo_NN_path columns consistently or use the photo register as a separate application table.

APPLICATION IMPORT
Map amenity_type, latitude, longitude, name and photo paths to your current application schema. CSV stores file references, not embedded images. Serve/upload the photos folder with the dataset.

EDITING AND SYNCHRONISATION
CSV and workbook are matching export snapshots, not live-linked. After edits, regenerate the combined CSV from all three category tables; saving just one worksheet as CSV will omit the other categories.

CHECKS COMPLETED
13 unique facility IDs; 64 unique photo IDs; 13 cover images; 13 geotag images; source page counts reconciled; all referenced images exist; six-decimal coordinate display; CSV round-trip and workbook values checked.
