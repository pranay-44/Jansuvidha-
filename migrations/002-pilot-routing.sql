INSERT INTO departments (id,name)
SELECT '7fd9bb1b-7656-4a33-865b-128e248a9a01','Civic amenities (pilot)'
WHERE NOT EXISTS (SELECT 1 FROM departments);
INSERT INTO jurisdictions (id,name)
SELECT '7fd9bb1b-7656-4a33-865b-128e248a9a02','Thane pilot area'
WHERE NOT EXISTS (SELECT 1 FROM jurisdictions);
