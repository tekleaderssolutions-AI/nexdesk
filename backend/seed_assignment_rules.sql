-- =============================================================================
-- seed_assignment_rules.sql
-- Maps every subcategory to its responsible team.
-- Idempotent: uses WHERE NOT EXISTS — safe to run multiple times.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Access Management  →  IAM Team
-- -----------------------------------------------------------------------------
INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'de189ffc-3a1c-4deb-beff-e35aae5fa727',  -- Access Management
       'fec42eb4-b52a-4fe5-8253-e8667e7d7a7d',  -- Password Reset
       'f9edddf8-2671-4786-aee3-8433a8cb62b0',  -- IAM Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'de189ffc-3a1c-4deb-beff-e35aae5fa727'
      AND subcategory_id = 'fec42eb4-b52a-4fe5-8253-e8667e7d7a7d'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'de189ffc-3a1c-4deb-beff-e35aae5fa727',  -- Access Management
       '51842eec-1697-4b57-bbcb-dc6626e6755c',  -- Account Unlock
       'f9edddf8-2671-4786-aee3-8433a8cb62b0',  -- IAM Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'de189ffc-3a1c-4deb-beff-e35aae5fa727'
      AND subcategory_id = '51842eec-1697-4b57-bbcb-dc6626e6755c'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'de189ffc-3a1c-4deb-beff-e35aae5fa727',  -- Access Management
       'f0cf875e-6bfb-4b79-a4d5-f2ef05185914',  -- MFA Issue
       'f9edddf8-2671-4786-aee3-8433a8cb62b0',  -- IAM Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'de189ffc-3a1c-4deb-beff-e35aae5fa727'
      AND subcategory_id = 'f0cf875e-6bfb-4b79-a4d5-f2ef05185914'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'de189ffc-3a1c-4deb-beff-e35aae5fa727',  -- Access Management
       '5656d2ae-72a7-45b7-8c4f-0c16cbfa1072',  -- New User Access
       'f9edddf8-2671-4786-aee3-8433a8cb62b0',  -- IAM Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'de189ffc-3a1c-4deb-beff-e35aae5fa727'
      AND subcategory_id = '5656d2ae-72a7-45b7-8c4f-0c16cbfa1072'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'de189ffc-3a1c-4deb-beff-e35aae5fa727',  -- Access Management
       '4f2119d8-3ba6-441a-908d-57765d6acdbf',  -- Role Change
       'f9edddf8-2671-4786-aee3-8433a8cb62b0',  -- IAM Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'de189ffc-3a1c-4deb-beff-e35aae5fa727'
      AND subcategory_id = '4f2119d8-3ba6-441a-908d-57765d6acdbf'
);

-- -----------------------------------------------------------------------------
-- VPN  →  Network Team
-- -----------------------------------------------------------------------------
INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '2b61e4d6-d33f-4a1f-88d5-8c80bed190a4',  -- VPN
       '607c06be-af64-4e50-9d46-75411d35bc4d',  -- VPN Connection Failure
       '8a1ad772-1d00-48a0-acda-842f806e573e',  -- Network Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '2b61e4d6-d33f-4a1f-88d5-8c80bed190a4'
      AND subcategory_id = '607c06be-af64-4e50-9d46-75411d35bc4d'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '2b61e4d6-d33f-4a1f-88d5-8c80bed190a4',  -- VPN
       '5850356e-ecab-4537-8e85-0613e3c7174e',  -- VPN Access Request
       '8a1ad772-1d00-48a0-acda-842f806e573e',  -- Network Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '2b61e4d6-d33f-4a1f-88d5-8c80bed190a4'
      AND subcategory_id = '5850356e-ecab-4537-8e85-0613e3c7174e'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '2b61e4d6-d33f-4a1f-88d5-8c80bed190a4',  -- VPN
       '64caf861-dd9a-46d2-8a18-1c0ac93b8671',  -- VPN Authentication Error
       '8a1ad772-1d00-48a0-acda-842f806e573e',  -- Network Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '2b61e4d6-d33f-4a1f-88d5-8c80bed190a4'
      AND subcategory_id = '64caf861-dd9a-46d2-8a18-1c0ac93b8671'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '2b61e4d6-d33f-4a1f-88d5-8c80bed190a4',  -- VPN
       'a5f7c7fd-7275-4bc1-92d4-60f0cf5e8166',  -- VPN Performance Issue
       '8a1ad772-1d00-48a0-acda-842f806e573e',  -- Network Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '2b61e4d6-d33f-4a1f-88d5-8c80bed190a4'
      AND subcategory_id = 'a5f7c7fd-7275-4bc1-92d4-60f0cf5e8166'
);

-- -----------------------------------------------------------------------------
-- Network  →  Network Team
-- -----------------------------------------------------------------------------
INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '88b720c2-2ed2-4e8e-a1d6-6b6e59f759b8',  -- Network
       '765b19bb-3da5-4e57-afd6-9f834380490c',  -- Internet Down
       '8a1ad772-1d00-48a0-acda-842f806e573e',  -- Network Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '88b720c2-2ed2-4e8e-a1d6-6b6e59f759b8'
      AND subcategory_id = '765b19bb-3da5-4e57-afd6-9f834380490c'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '88b720c2-2ed2-4e8e-a1d6-6b6e59f759b8',  -- Network
       'b8857b06-1375-48e7-a87b-7461a255155a',  -- LAN Issue
       '8a1ad772-1d00-48a0-acda-842f806e573e',  -- Network Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '88b720c2-2ed2-4e8e-a1d6-6b6e59f759b8'
      AND subcategory_id = 'b8857b06-1375-48e7-a87b-7461a255155a'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '88b720c2-2ed2-4e8e-a1d6-6b6e59f759b8',  -- Network
       'b75227f2-9eb9-44ae-9388-1ef3d01eb520',  -- WiFi Issue
       '8a1ad772-1d00-48a0-acda-842f806e573e',  -- Network Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '88b720c2-2ed2-4e8e-a1d6-6b6e59f759b8'
      AND subcategory_id = 'b75227f2-9eb9-44ae-9388-1ef3d01eb520'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '88b720c2-2ed2-4e8e-a1d6-6b6e59f759b8',  -- Network
       '2952179a-a109-43f9-80cc-2807817ba688',  -- Firewall Request
       '8a1ad772-1d00-48a0-acda-842f806e573e',  -- Network Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '88b720c2-2ed2-4e8e-a1d6-6b6e59f759b8'
      AND subcategory_id = '2952179a-a109-43f9-80cc-2807817ba688'
);

-- -----------------------------------------------------------------------------
-- Hardware  →  Desktop Support
-- -----------------------------------------------------------------------------
INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'e3cfbdaf-f06f-4ae8-b8ce-49378c7d7d25',  -- Hardware
       '6c4dca5c-7587-4118-9bd8-369d4dd1109d',  -- Laptop Issue
       'bbe66c85-a0c2-46b0-871b-43826782c37c',  -- Desktop Support
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'e3cfbdaf-f06f-4ae8-b8ce-49378c7d7d25'
      AND subcategory_id = '6c4dca5c-7587-4118-9bd8-369d4dd1109d'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'e3cfbdaf-f06f-4ae8-b8ce-49378c7d7d25',  -- Hardware
       'b8773ce6-2ad2-4d7e-ad78-614524267a40',  -- Desktop Issue
       'bbe66c85-a0c2-46b0-871b-43826782c37c',  -- Desktop Support
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'e3cfbdaf-f06f-4ae8-b8ce-49378c7d7d25'
      AND subcategory_id = 'b8773ce6-2ad2-4d7e-ad78-614524267a40'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'e3cfbdaf-f06f-4ae8-b8ce-49378c7d7d25',  -- Hardware
       '73145457-6da8-4800-89a5-f37cfa2650fc',  -- Keyboard / Mouse Issue
       'bbe66c85-a0c2-46b0-871b-43826782c37c',  -- Desktop Support
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'e3cfbdaf-f06f-4ae8-b8ce-49378c7d7d25'
      AND subcategory_id = '73145457-6da8-4800-89a5-f37cfa2650fc'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'e3cfbdaf-f06f-4ae8-b8ce-49378c7d7d25',  -- Hardware
       '0adb59c9-3e34-4225-9a1c-ae906169e0f6',  -- Monitor Issue
       'bbe66c85-a0c2-46b0-871b-43826782c37c',  -- Desktop Support
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'e3cfbdaf-f06f-4ae8-b8ce-49378c7d7d25'
      AND subcategory_id = '0adb59c9-3e34-4225-9a1c-ae906169e0f6'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'e3cfbdaf-f06f-4ae8-b8ce-49378c7d7d25',  -- Hardware
       '2b23aeca-7007-4707-895b-a8b7132a82e0',  -- Printer Issue
       'bbe66c85-a0c2-46b0-871b-43826782c37c',  -- Desktop Support
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'e3cfbdaf-f06f-4ae8-b8ce-49378c7d7d25'
      AND subcategory_id = '2b23aeca-7007-4707-895b-a8b7132a82e0'
);

-- -----------------------------------------------------------------------------
-- Email & Collaboration  →  Messaging Team
-- -----------------------------------------------------------------------------
INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'a06380cc-e468-472d-a645-f44b5d3ada71',  -- Email & Collaboration
       '0886b20e-a94f-4d66-b0dd-bd62b0eff6f2',  -- Email Not Sending
       '31ef1bb8-437b-4227-be90-9a1267ae7c0c',  -- Messaging Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'a06380cc-e468-472d-a645-f44b5d3ada71'
      AND subcategory_id = '0886b20e-a94f-4d66-b0dd-bd62b0eff6f2'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'a06380cc-e468-472d-a645-f44b5d3ada71',  -- Email & Collaboration
       'af0e980b-67d5-452f-85db-ef2ef2a46c48',  -- Email Not Receiving
       '31ef1bb8-437b-4227-be90-9a1267ae7c0c',  -- Messaging Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'a06380cc-e468-472d-a645-f44b5d3ada71'
      AND subcategory_id = 'af0e980b-67d5-452f-85db-ef2ef2a46c48'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'a06380cc-e468-472d-a645-f44b5d3ada71',  -- Email & Collaboration
       '9d3a031b-0f6f-4631-9dfd-9e0216877215',  -- Mailbox Access
       '31ef1bb8-437b-4227-be90-9a1267ae7c0c',  -- Messaging Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'a06380cc-e468-472d-a645-f44b5d3ada71'
      AND subcategory_id = '9d3a031b-0f6f-4631-9dfd-9e0216877215'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'a06380cc-e468-472d-a645-f44b5d3ada71',  -- Email & Collaboration
       'c0c44a8a-3242-4446-af34-22bbd7624231',  -- Shared Mailbox
       '31ef1bb8-437b-4227-be90-9a1267ae7c0c',  -- Messaging Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'a06380cc-e468-472d-a645-f44b5d3ada71'
      AND subcategory_id = 'c0c44a8a-3242-4446-af34-22bbd7624231'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'a06380cc-e468-472d-a645-f44b5d3ada71',  -- Email & Collaboration
       '7dfa1258-82d8-4964-80b7-d3761ed37aeb',  -- Distribution List
       '31ef1bb8-437b-4227-be90-9a1267ae7c0c',  -- Messaging Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'a06380cc-e468-472d-a645-f44b5d3ada71'
      AND subcategory_id = '7dfa1258-82d8-4964-80b7-d3761ed37aeb'
);

-- -----------------------------------------------------------------------------
-- Payroll  →  Payroll Team
-- -----------------------------------------------------------------------------
INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'c758b18f-2563-4bd4-b9bc-5c52996b2a82',  -- Payroll
       '481f0257-a9f8-4a4a-8a25-28ee8c138bb6',  -- Salary Not Credited
       '8e736eba-fedb-4236-aaca-4a67ed0d437c',  -- Payroll Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'c758b18f-2563-4bd4-b9bc-5c52996b2a82'
      AND subcategory_id = '481f0257-a9f8-4a4a-8a25-28ee8c138bb6'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'c758b18f-2563-4bd4-b9bc-5c52996b2a82',  -- Payroll
       'c70126a9-76a5-4f8c-b250-98be4ad1a320',  -- Payslip Request
       '8e736eba-fedb-4236-aaca-4a67ed0d437c',  -- Payroll Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'c758b18f-2563-4bd4-b9bc-5c52996b2a82'
      AND subcategory_id = 'c70126a9-76a5-4f8c-b250-98be4ad1a320'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'c758b18f-2563-4bd4-b9bc-5c52996b2a82',  -- Payroll
       'c93c1b7d-22eb-47c3-b238-dad8c40e90f6',  -- Payroll Correction Request
       '8e736eba-fedb-4236-aaca-4a67ed0d437c',  -- Payroll Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'c758b18f-2563-4bd4-b9bc-5c52996b2a82'
      AND subcategory_id = 'c93c1b7d-22eb-47c3-b238-dad8c40e90f6'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'c758b18f-2563-4bd4-b9bc-5c52996b2a82',  -- Payroll
       '7a5dafc0-8fc8-460c-be2f-4fb9cbb7a3d3',  -- Tax Deduction Query
       '8e736eba-fedb-4236-aaca-4a67ed0d437c',  -- Payroll Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'c758b18f-2563-4bd4-b9bc-5c52996b2a82'
      AND subcategory_id = '7a5dafc0-8fc8-460c-be2f-4fb9cbb7a3d3'
);

-- -----------------------------------------------------------------------------
-- SAP  →  Service Desk  (no dedicated SAP team in current data)
-- -----------------------------------------------------------------------------
INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '0bcae408-c88c-4e36-b2ac-16e1da566bfc',  -- SAP
       '6037580d-0db5-4faa-85f3-0c77919ed574',  -- SAP Login Issue
       'eb788d28-cccf-42f0-b5e1-bde99b207be8',  -- Service Desk
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '0bcae408-c88c-4e36-b2ac-16e1da566bfc'
      AND subcategory_id = '6037580d-0db5-4faa-85f3-0c77919ed574'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '0bcae408-c88c-4e36-b2ac-16e1da566bfc',  -- SAP
       '18c8520d-f45f-4858-a68f-8b28dd915841',  -- SAP Performance Issue
       'eb788d28-cccf-42f0-b5e1-bde99b207be8',  -- Service Desk
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '0bcae408-c88c-4e36-b2ac-16e1da566bfc'
      AND subcategory_id = '18c8520d-f45f-4858-a68f-8b28dd915841'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '0bcae408-c88c-4e36-b2ac-16e1da566bfc',  -- SAP
       '14c2141c-4307-475b-8028-5cb6e75bd2d8',  -- SAP Authorization Issue
       'eb788d28-cccf-42f0-b5e1-bde99b207be8',  -- Service Desk
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '0bcae408-c88c-4e36-b2ac-16e1da566bfc'
      AND subcategory_id = '14c2141c-4307-475b-8028-5cb6e75bd2d8'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '0bcae408-c88c-4e36-b2ac-16e1da566bfc',  -- SAP
       '388d01f1-82ba-4998-941c-6b956b9b0157',  -- SAP Transaction Error
       'eb788d28-cccf-42f0-b5e1-bde99b207be8',  -- Service Desk
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '0bcae408-c88c-4e36-b2ac-16e1da566bfc'
      AND subcategory_id = '388d01f1-82ba-4998-941c-6b956b9b0157'
);

-- -----------------------------------------------------------------------------
-- Software  →  Service Desk (application issues) / Desktop Support (installs)
-- -----------------------------------------------------------------------------
INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '9b21efae-686c-457d-8286-dd4e3c800cc0',  -- Software
       'd0f2aaba-d994-4c74-9aac-528040828a1e',  -- Application Error
       'eb788d28-cccf-42f0-b5e1-bde99b207be8',  -- Service Desk
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '9b21efae-686c-457d-8286-dd4e3c800cc0'
      AND subcategory_id = 'd0f2aaba-d994-4c74-9aac-528040828a1e'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '9b21efae-686c-457d-8286-dd4e3c800cc0',  -- Software
       '9f5cbd5d-8952-46da-bcbe-45a49107693d',  -- License Request
       'eb788d28-cccf-42f0-b5e1-bde99b207be8',  -- Service Desk
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '9b21efae-686c-457d-8286-dd4e3c800cc0'
      AND subcategory_id = '9f5cbd5d-8952-46da-bcbe-45a49107693d'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '9b21efae-686c-457d-8286-dd4e3c800cc0',  -- Software
       'a5ace94b-e9e0-4922-8227-b4728d0f7288',  -- Software Installation
       'bbe66c85-a0c2-46b0-871b-43826782c37c',  -- Desktop Support
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '9b21efae-686c-457d-8286-dd4e3c800cc0'
      AND subcategory_id = 'a5ace94b-e9e0-4922-8227-b4728d0f7288'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '9b21efae-686c-457d-8286-dd4e3c800cc0',  -- Software
       '87beb084-105c-4fb4-82d1-36eead65cbf2',  -- Software Upgrade
       'bbe66c85-a0c2-46b0-871b-43826782c37c',  -- Desktop Support
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '9b21efae-686c-457d-8286-dd4e3c800cc0'
      AND subcategory_id = '87beb084-105c-4fb4-82d1-36eead65cbf2'
);

-- -----------------------------------------------------------------------------
-- Finance  →  Accounts Payable / Accounts Receivable
-- -----------------------------------------------------------------------------
INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'f041b88a-29de-4bae-ac6a-6b6bbf738010',  -- Finance
       '47f9e1cb-89ce-4ab4-b461-b9c751dd3d3f',  -- Expense Reimbursement
       '950c3df0-82bd-455e-be4e-11dc61406e1d',  -- Accounts Payable
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'f041b88a-29de-4bae-ac6a-6b6bbf738010'
      AND subcategory_id = '47f9e1cb-89ce-4ab4-b461-b9c751dd3d3f'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'f041b88a-29de-4bae-ac6a-6b6bbf738010',  -- Finance
       'fbcb6aaa-dcc7-4b8f-9b45-81cba253dd2a',  -- Invoice Issue
       '950c3df0-82bd-455e-be4e-11dc61406e1d',  -- Accounts Payable
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'f041b88a-29de-4bae-ac6a-6b6bbf738010'
      AND subcategory_id = 'fbcb6aaa-dcc7-4b8f-9b45-81cba253dd2a'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'f041b88a-29de-4bae-ac6a-6b6bbf738010',  -- Finance
       'b7d230d7-3f55-486a-920b-f6e6d23fcb19',  -- Payment Query
       'e52db944-5dc5-43f8-a91e-8bd558704403',  -- Accounts Receivable
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'f041b88a-29de-4bae-ac6a-6b6bbf738010'
      AND subcategory_id = 'b7d230d7-3f55-486a-920b-f6e6d23fcb19'
);

-- -----------------------------------------------------------------------------
-- HRMS  →  HR Operations (portal/profile issues) / Payroll Team (payroll portal)
-- -----------------------------------------------------------------------------
INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '134fc62f-40b3-4967-8f1e-7c9adeb987a4',  -- HRMS
       '49aa1d42-8c14-48c7-b916-6f237cf10a51',  -- Attendance Issue
       '4144936e-0d93-4480-9b81-6a43cdf808bb',  -- HR Operations
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '134fc62f-40b3-4967-8f1e-7c9adeb987a4'
      AND subcategory_id = '49aa1d42-8c14-48c7-b916-6f237cf10a51'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '134fc62f-40b3-4967-8f1e-7c9adeb987a4',  -- HRMS
       '0a05250f-c9b8-434a-924e-0a981c4d71e5',  -- Employee Profile Update
       '4144936e-0d93-4480-9b81-6a43cdf808bb',  -- HR Operations
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '134fc62f-40b3-4967-8f1e-7c9adeb987a4'
      AND subcategory_id = '0a05250f-c9b8-434a-924e-0a981c4d71e5'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '134fc62f-40b3-4967-8f1e-7c9adeb987a4',  -- HRMS
       '57843b07-2811-4ae2-a752-156ff5db9163',  -- Leave Issue
       '4144936e-0d93-4480-9b81-6a43cdf808bb',  -- HR Operations
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '134fc62f-40b3-4967-8f1e-7c9adeb987a4'
      AND subcategory_id = '57843b07-2811-4ae2-a752-156ff5db9163'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '134fc62f-40b3-4967-8f1e-7c9adeb987a4',  -- HRMS
       '9ce00c12-e633-4212-8eaf-0dd23b088064',  -- Payroll Portal Issue
       '8e736eba-fedb-4236-aaca-4a67ed0d437c',  -- Payroll Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '134fc62f-40b3-4967-8f1e-7c9adeb987a4'
      AND subcategory_id = '9ce00c12-e633-4212-8eaf-0dd23b088064'
);

-- -----------------------------------------------------------------------------
-- Human Resources  →  HR Operations / Recruitment Team
-- -----------------------------------------------------------------------------
INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '151bed82-30e0-4610-a7cb-78233695305c',  -- Human Resources
       '5c4440e6-e4d9-4ed7-ac31-dc7bf1f85854',  -- Employee Grievance
       '4144936e-0d93-4480-9b81-6a43cdf808bb',  -- HR Operations
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '151bed82-30e0-4610-a7cb-78233695305c'
      AND subcategory_id = '5c4440e6-e4d9-4ed7-ac31-dc7bf1f85854'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '151bed82-30e0-4610-a7cb-78233695305c',  -- Human Resources
       'c422ed3a-6918-4739-8486-5a18605db9e9',  -- Policy Clarification
       '4144936e-0d93-4480-9b81-6a43cdf808bb',  -- HR Operations
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '151bed82-30e0-4610-a7cb-78233695305c'
      AND subcategory_id = 'c422ed3a-6918-4739-8486-5a18605db9e9'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '151bed82-30e0-4610-a7cb-78233695305c',  -- Human Resources
       '3ec9e67b-a229-4339-be96-8cd1944a9f17',  -- Recruitment Query
       '16a28883-ecad-4984-9fc5-ce1eef7f5dd4',  -- Recruitment Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '151bed82-30e0-4610-a7cb-78233695305c'
      AND subcategory_id = '3ec9e67b-a229-4339-be96-8cd1944a9f17'
);

-- -----------------------------------------------------------------------------
-- Database  →  Database Team
-- -----------------------------------------------------------------------------
INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'ef884ddc-083d-4ccb-9084-e4d07101410c',  -- Database
       '10b74d03-df16-4c3c-b19b-d3a72ddc8c2d',  -- Backup Restore Request
       '6ee75504-c25b-49de-b727-1b321085f680',  -- Database Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'ef884ddc-083d-4ccb-9084-e4d07101410c'
      AND subcategory_id = '10b74d03-df16-4c3c-b19b-d3a72ddc8c2d'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'ef884ddc-083d-4ccb-9084-e4d07101410c',  -- Database
       'f53846ae-21de-4a88-8221-f866a7898da5',  -- Database Connectivity Issue
       '6ee75504-c25b-49de-b727-1b321085f680',  -- Database Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'ef884ddc-083d-4ccb-9084-e4d07101410c'
      AND subcategory_id = 'f53846ae-21de-4a88-8221-f866a7898da5'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       'ef884ddc-083d-4ccb-9084-e4d07101410c',  -- Database
       '0aa8d4cf-fcba-4594-b645-1f9ee8b95c65',  -- Database Performance Issue
       '6ee75504-c25b-49de-b727-1b321085f680',  -- Database Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = 'ef884ddc-083d-4ccb-9084-e4d07101410c'
      AND subcategory_id = '0aa8d4cf-fcba-4594-b645-1f9ee8b95c65'
);

-- -----------------------------------------------------------------------------
-- Cloud Infrastructure  →  Cloud Team
-- -----------------------------------------------------------------------------
INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '88188c9a-f18b-4042-b179-c62b7575665f',  -- Cloud Infrastructure
       'c1f04290-e207-4fc6-9767-52f0e55e1f79',  -- Cloud Access Issue
       '593bb5d8-9b6d-4bf3-84dc-602846c0286b',  -- Cloud Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '88188c9a-f18b-4042-b179-c62b7575665f'
      AND subcategory_id = 'c1f04290-e207-4fc6-9767-52f0e55e1f79'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '88188c9a-f18b-4042-b179-c62b7575665f',  -- Cloud Infrastructure
       'fa926048-d93b-4737-807c-b7cb3945516c',  -- Cloud Resource Failure
       '593bb5d8-9b6d-4bf3-84dc-602846c0286b',  -- Cloud Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '88188c9a-f18b-4042-b179-c62b7575665f'
      AND subcategory_id = 'fa926048-d93b-4737-807c-b7cb3945516c'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '88188c9a-f18b-4042-b179-c62b7575665f',  -- Cloud Infrastructure
       '513b6eac-8937-416d-9260-c69b30b582de',  -- VM Provisioning
       '593bb5d8-9b6d-4bf3-84dc-602846c0286b',  -- Cloud Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '88188c9a-f18b-4042-b179-c62b7575665f'
      AND subcategory_id = '513b6eac-8937-416d-9260-c69b30b582de'
);

-- -----------------------------------------------------------------------------
-- Server Infrastructure  →  Server Team
-- -----------------------------------------------------------------------------
INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '999f6495-1c6d-46da-8490-9dc42aa9d1b5',  -- Server Infrastructure
       'a4c0cc37-50df-41f1-a00e-711804bc7a0d',  -- Server Access Request
       'd96b5d4a-db37-43d8-a223-b2f8fac6364c',  -- Server Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '999f6495-1c6d-46da-8490-9dc42aa9d1b5'
      AND subcategory_id = 'a4c0cc37-50df-41f1-a00e-711804bc7a0d'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '999f6495-1c6d-46da-8490-9dc42aa9d1b5',  -- Server Infrastructure
       '269af8df-a7bc-433e-9597-b31405c1dad0',  -- Server Down
       'd96b5d4a-db37-43d8-a223-b2f8fac6364c',  -- Server Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '999f6495-1c6d-46da-8490-9dc42aa9d1b5'
      AND subcategory_id = '269af8df-a7bc-433e-9597-b31405c1dad0'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '999f6495-1c6d-46da-8490-9dc42aa9d1b5',  -- Server Infrastructure
       'f4fe05ce-70ec-4123-8000-4e20d12511f9',  -- Storage Issue
       'd96b5d4a-db37-43d8-a223-b2f8fac6364c',  -- Server Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '999f6495-1c6d-46da-8490-9dc42aa9d1b5'
      AND subcategory_id = 'f4fe05ce-70ec-4123-8000-4e20d12511f9'
);

-- -----------------------------------------------------------------------------
-- Information Security  →  SOC Team / Vulnerability Management
-- -----------------------------------------------------------------------------
INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '5d4daefb-8f09-4108-96fe-6f0dc7a7345b',  -- Information Security
       '171b2f4b-d75d-4af9-b6eb-5cc3aa130a4e',  -- Malware Alert
       'e9935ace-e09c-4b2e-9d53-090725ec929a',  -- SOC Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '5d4daefb-8f09-4108-96fe-6f0dc7a7345b'
      AND subcategory_id = '171b2f4b-d75d-4af9-b6eb-5cc3aa130a4e'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '5d4daefb-8f09-4108-96fe-6f0dc7a7345b',  -- Information Security
       '537dedbe-716a-4dd1-b365-7b00beda1e89',  -- Phishing Report
       'e9935ace-e09c-4b2e-9d53-090725ec929a',  -- SOC Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '5d4daefb-8f09-4108-96fe-6f0dc7a7345b'
      AND subcategory_id = '537dedbe-716a-4dd1-b365-7b00beda1e89'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '5d4daefb-8f09-4108-96fe-6f0dc7a7345b',  -- Information Security
       'fb8e6f5c-f01d-46cc-bab2-b17989077534',  -- Security Incident
       'e9935ace-e09c-4b2e-9d53-090725ec929a',  -- SOC Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '5d4daefb-8f09-4108-96fe-6f0dc7a7345b'
      AND subcategory_id = 'fb8e6f5c-f01d-46cc-bab2-b17989077534'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '5d4daefb-8f09-4108-96fe-6f0dc7a7345b',  -- Information Security
       '53b27f2b-0018-49d3-9a99-c938bea36135',  -- Vulnerability Report
       '523b577a-fba4-424f-925e-17f303c764b7',  -- Vulnerability Management
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '5d4daefb-8f09-4108-96fe-6f0dc7a7345b'
      AND subcategory_id = '53b27f2b-0018-49d3-9a99-c938bea36135'
);

-- -----------------------------------------------------------------------------
-- Facilities  →  per-subcategory team (Electrical, HVAC, Housekeeping, Service Desk)
-- -----------------------------------------------------------------------------
INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '1ae96f57-e9a8-4ec9-973c-df25adff3fb0',  -- Facilities
       '696bff20-2100-46d2-ad6b-e551d89ba979',  -- Electrical Issue
       'a1c0f6f8-851d-4447-a725-3f96cd75554b',  -- Electrical Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '1ae96f57-e9a8-4ec9-973c-df25adff3fb0'
      AND subcategory_id = '696bff20-2100-46d2-ad6b-e551d89ba979'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '1ae96f57-e9a8-4ec9-973c-df25adff3fb0',  -- Facilities
       '05041cbb-a5d8-4adf-a047-bc290cc755b5',  -- HVAC Issue
       '6f7b4745-faea-4426-9860-118b8c589278',  -- HVAC Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '1ae96f57-e9a8-4ec9-973c-df25adff3fb0'
      AND subcategory_id = '05041cbb-a5d8-4adf-a047-bc290cc755b5'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '1ae96f57-e9a8-4ec9-973c-df25adff3fb0',  -- Facilities
       '4f3a10ee-e24f-4ae6-9631-ded02b31212d',  -- Housekeeping Request
       'ad38bdd1-6650-4921-b4fd-e4fedddb029f',  -- Housekeeping Team
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '1ae96f57-e9a8-4ec9-973c-df25adff3fb0'
      AND subcategory_id = '4f3a10ee-e24f-4ae6-9631-ded02b31212d'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '1ae96f57-e9a8-4ec9-973c-df25adff3fb0',  -- Facilities
       '043ee898-e708-4ab0-aa29-2683d31d9c6d',  -- Civil Maintenance
       'eb788d28-cccf-42f0-b5e1-bde99b207be8',  -- Service Desk (no civil team)
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '1ae96f57-e9a8-4ec9-973c-df25adff3fb0'
      AND subcategory_id = '043ee898-e708-4ab0-aa29-2683d31d9c6d'
);

-- -----------------------------------------------------------------------------
-- Procurement  →  Accounts Payable
-- -----------------------------------------------------------------------------
INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '30dcb741-7d87-46ea-8812-f2822bf5fc66',  -- Procurement
       'eab18b40-cbe0-459e-9a84-ba0d3f0a22c4',  -- Purchase Request
       '950c3df0-82bd-455e-be4e-11dc61406e1d',  -- Accounts Payable
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '30dcb741-7d87-46ea-8812-f2822bf5fc66'
      AND subcategory_id = 'eab18b40-cbe0-459e-9a84-ba0d3f0a22c4'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '30dcb741-7d87-46ea-8812-f2822bf5fc66',  -- Procurement
       '0dbbf508-9ac0-405b-9aaf-641becfacee3',  -- PO Clarification
       '950c3df0-82bd-455e-be4e-11dc61406e1d',  -- Accounts Payable
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '30dcb741-7d87-46ea-8812-f2822bf5fc66'
      AND subcategory_id = '0dbbf508-9ac0-405b-9aaf-641becfacee3'
);

INSERT INTO assignment_rules (id, category_id, subcategory_id, team_id, is_active)
SELECT gen_random_uuid(),
       '30dcb741-7d87-46ea-8812-f2822bf5fc66',  -- Procurement
       'ee8f5a80-557f-4a01-80c7-763464313aad',  -- Vendor Issue
       '950c3df0-82bd-455e-be4e-11dc61406e1d',  -- Accounts Payable
       true
WHERE NOT EXISTS (
    SELECT 1 FROM assignment_rules
    WHERE category_id = '30dcb741-7d87-46ea-8812-f2822bf5fc66'
      AND subcategory_id = 'ee8f5a80-557f-4a01-80c7-763464313aad'
);
