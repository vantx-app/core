--
-- PostgreSQL database dump
--

-- Dumped from database version 17.10
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: Organization; Type: TABLE DATA; Schema: public; Owner: postgres
--

SET SESSION AUTHORIZATION DEFAULT;

ALTER TABLE public."Organization" DISABLE TRIGGER ALL;

INSERT INTO public."Organization" VALUES ('ada2c63b-3369-47e3-9934-6cc8d6498fb3', 'Flota de Irvin Meneses', '2026-05-17 19:39:23.471');


ALTER TABLE public."Organization" ENABLE TRIGGER ALL;

--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public."User" DISABLE TRIGGER ALL;

INSERT INTO public."User" VALUES ('5df8a395-331c-4043-8c5a-ba1882bb514b', 'admin@vantx.app', '$2b$10$vulAmdUt6few/qr6lEdIvudDjbaJPoMrPad4zRoQsXrlboLh8brlW', 'Admin', 'SUPER_ADMIN', 'ada2c63b-3369-47e3-9934-6cc8d6498fb3', '2026-05-17 19:41:00.893', '2026-05-17 19:41:00.893');
INSERT INTO public."User" VALUES ('6c06c202-d8c3-4b39-831e-0df5cdbe2250', 'paolamichele.1305@gmail.com', '$2b$10$JMQKnQ18tkISdCM2NxV3mOX2FdYQO6Re6kG/DHzh1GzCZtoEhPE7G', 'Paola Jimenez', 'DRIVER', NULL, '2026-05-17 19:46:06.036', '2026-05-17 19:46:06.036');


ALTER TABLE public."User" ENABLE TRIGGER ALL;

--
-- Data for Name: Driver; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public."Driver" DISABLE TRIGGER ALL;

INSERT INTO public."Driver" VALUES ('4f658b44-5724-4419-91aa-23ad96b2d0f1', '5df8a395-331c-4043-8c5a-ba1882bb514b', 'Irvin', 'Meneses', '8-991-1976', NULL, 'ACTIVE', NULL, false, '2026-05-17 19:48:43.047', '2026-05-17 19:47:55.489');
INSERT INTO public."Driver" VALUES ('0fb6f8e0-c8d1-4da8-a216-a0e9636d0c6d', '6c06c202-d8c3-4b39-831e-0df5cdbe2250', 'Paola', 'Jimenez', '8-990-2145', NULL, 'ACTIVE', NULL, false, '2026-05-17 19:49:50.897', '2026-05-17 19:49:31.072');


ALTER TABLE public."Driver" ENABLE TRIGGER ALL;

--
-- Data for Name: ScoringProfile; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public."ScoringProfile" DISABLE TRIGGER ALL;

INSERT INTO public."ScoringProfile" VALUES ('f5098e80-8846-4674-96fc-42ca8b46f52c', NULL, 'DEFAULT', '{"rules": [{"code": "OVERSPEEDING", "pillar": "SAFETY", "threshold": 110, "maxDeduction": 20, "deductionPerSeverityUnit": 0.0167}, {"code": "HARSH_BRAKING", "pillar": "SAFETY", "threshold": 400, "maxDeduction": 20, "deductionPer100Km": 10}, {"code": "HARSH_CORNERING", "pillar": "SAFETY", "threshold": 380, "maxDeduction": 20, "deductionPer100Km": 10}, {"code": "EXCESSIVE_IDLING", "pillar": "EFFICIENCY", "maxDeduction": 15, "deductionPer100Km": 5}, {"code": "HARSH_ACCELERATION", "pillar": "EFFICIENCY", "threshold": 250, "maxDeduction": 10, "deductionPer100Km": 6}, {"code": "HIGH_RPM", "pillar": "ASSET_CARE", "threshold": 3800, "maxDeduction": 55, "maxThreshold": 5500, "deductionPerSeverityUnit": 0.05}, {"code": "COLD_ENGINE_STRAIN", "pillar": "ASSET_CARE", "maxDeduction": 50, "deductionPerEvent": 10}, {"code": "HIGH_LOAD_STRAIN", "pillar": "ASSET_CARE", "maxDeduction": 35, "deductionPer100Km": 8}, {"code": "ENGINE_LUGGING", "pillar": "ASSET_CARE", "maxDeduction": 40, "deductionPer100Km": 15}, {"code": "DEVICE_UNPLUGGED", "pillar": "ASSET_CARE", "maxDeduction": 30, "deductionPerEvent": 10}], "pillars": {"SAFETY": {"weight": 0.4, "baseScore": 100}, "ASSET_CARE": {"weight": 0.5, "baseScore": 100}, "EFFICIENCY": {"weight": 0.1, "baseScore": 100}}, "engineVersion": "0.1"}', '2026-05-17 19:51:28.036', '2026-05-17 19:50:49.922');

INSERT INTO public."ScoringProfile" VALUES ('b8de8e80-8846-4674-96fc-42ca8b46f52a', NULL, 'DEFAULT_HDV', '{"rules": [{"code": "OVERSPEEDING", "pillar": "SAFETY", "threshold": 90, "maxDeduction": 20, "deductionPerSeverityUnit": 0.0167}, {"code": "HARSH_BRAKING", "pillar": "SAFETY", "threshold": 220, "maxDeduction": 20, "deductionPerSeverityUnit": 0.25}, {"code": "HARSH_CORNERING", "pillar": "SAFETY", "threshold": 200, "maxDeduction": 20, "deductionPerSeverityUnit": 0.25}, {"code": "EXCESSIVE_IDLING", "pillar": "EFFICIENCY", "maxDeduction": 15, "deductionPer100Km": 5}, {"code": "HARSH_ACCELERATION", "pillar": "EFFICIENCY", "threshold": 180, "maxDeduction": 10, "deductionPerSeverityUnit": 0.20}, {"code": "HIGH_RPM", "pillar": "ASSET_CARE", "threshold": 2200, "maxDeduction": 55, "maxThreshold": 2300, "deductionPerSeverityUnit": 0.05}, {"code": "COLD_ENGINE_STRAIN", "pillar": "ASSET_CARE", "maxDeduction": 50, "deductionPerEvent": 10}, {"code": "HIGH_LOAD_STRAIN", "pillar": "ASSET_CARE", "maxDeduction": 35, "deductionPer100Km": 8}, {"code": "ENGINE_LUGGING", "pillar": "ASSET_CARE", "maxDeduction": 40, "deductionPer100Km": 15}, {"code": "DEVICE_UNPLUGGED", "pillar": "ASSET_CARE", "maxDeduction": 30, "deductionPerEvent": 10}], "pillars": {"SAFETY": {"weight": 0.4, "baseScore": 100}, "ASSET_CARE": {"weight": 0.5, "baseScore": 100}, "EFFICIENCY": {"weight": 0.1, "baseScore": 100}}, "engineVersion": "0.1"}', '2026-06-01 12:00:00.000', '2026-06-01 12:00:00.000');

INSERT INTO public."ScoringProfile" VALUES ('b8de8e80-8846-4674-96fc-42ca8b46f52b', NULL, 'DEFAULT_LCV', '{"rules": [{"code": "OVERSPEEDING", "pillar": "SAFETY", "threshold": 100, "maxDeduction": 20, "deductionPerSeverityUnit": 0.0167}, {"code": "HARSH_BRAKING", "pillar": "SAFETY", "threshold": 300, "maxDeduction": 20, "deductionPerSeverityUnit": 0.25}, {"code": "HARSH_CORNERING", "pillar": "SAFETY", "threshold": 250, "maxDeduction": 20, "deductionPerSeverityUnit": 0.25}, {"code": "EXCESSIVE_IDLING", "pillar": "EFFICIENCY", "maxDeduction": 15, "deductionPer100Km": 5}, {"code": "HARSH_ACCELERATION", "pillar": "EFFICIENCY", "threshold": 220, "maxDeduction": 10, "deductionPerSeverityUnit": 0.20}, {"code": "HIGH_RPM", "pillar": "ASSET_CARE", "threshold": 3000, "maxDeduction": 55, "maxThreshold": 4500, "deductionPerSeverityUnit": 0.05}, {"code": "COLD_ENGINE_STRAIN", "pillar": "ASSET_CARE", "maxDeduction": 50, "deductionPerEvent": 10}, {"code": "HIGH_LOAD_STRAIN", "pillar": "ASSET_CARE", "maxDeduction": 35, "deductionPer100Km": 8}, {"code": "ENGINE_LUGGING", "pillar": "ASSET_CARE", "maxDeduction": 40, "deductionPer100Km": 15}, {"code": "DEVICE_UNPLUGGED", "pillar": "ASSET_CARE", "maxDeduction": 30, "deductionPerEvent": 10}], "pillars": {"SAFETY": {"weight": 0.4, "baseScore": 100}, "ASSET_CARE": {"weight": 0.5, "baseScore": 100}, "EFFICIENCY": {"weight": 0.1, "baseScore": 100}}, "engineVersion": "0.1"}', '2026-06-01 12:00:00.000', '2026-06-01 12:00:00.000');

INSERT INTO public."ScoringProfile" VALUES ('b8de8e80-8846-4674-96fc-42ca8b46f52c', NULL, 'DEFAULT_PASSENGER', '{"rules": [{"code": "OVERSPEEDING", "pillar": "SAFETY", "threshold": 110, "maxDeduction": 20, "deductionPerSeverityUnit": 0.0167}, {"code": "HARSH_BRAKING", "pillar": "SAFETY", "threshold": 400, "maxDeduction": 20, "deductionPerSeverityUnit": 0.25}, {"code": "HARSH_CORNERING", "pillar": "SAFETY", "threshold": 380, "maxDeduction": 20, "deductionPerSeverityUnit": 0.25}, {"code": "EXCESSIVE_IDLING", "pillar": "EFFICIENCY", "maxDeduction": 15, "deductionPer100Km": 5}, {"code": "HARSH_ACCELERATION", "pillar": "EFFICIENCY", "threshold": 250, "maxDeduction": 10, "deductionPerSeverityUnit": 0.20}, {"code": "HIGH_RPM", "pillar": "ASSET_CARE", "threshold": 3800, "maxDeduction": 55, "maxThreshold": 5500, "deductionPerSeverityUnit": 0.05}, {"code": "COLD_ENGINE_STRAIN", "pillar": "ASSET_CARE", "maxDeduction": 50, "deductionPerEvent": 10}, {"code": "HIGH_LOAD_STRAIN", "pillar": "ASSET_CARE", "maxDeduction": 35, "deductionPer100Km": 8}, {"code": "ENGINE_LUGGING", "pillar": "ASSET_CARE", "maxDeduction": 40, "deductionPer100Km": 15}, {"code": "DEVICE_UNPLUGGED", "pillar": "ASSET_CARE", "maxDeduction": 30, "deductionPerEvent": 10}], "pillars": {"SAFETY": {"weight": 0.4, "baseScore": 100}, "ASSET_CARE": {"weight": 0.5, "baseScore": 100}, "EFFICIENCY": {"weight": 0.1, "baseScore": 100}}, "engineVersion": "0.1"}', '2026-06-01 12:00:00.000', '2026-06-01 12:00:00.000');

INSERT INTO public."ScoringProfile" VALUES ('b8de8e80-8846-4674-96fc-42ca8b46f52d', NULL, 'DEFAULT_MACHINERY', '{"rules": [{"code": "OVERSPEEDING", "pillar": "SAFETY", "threshold": 50, "maxDeduction": 20, "deductionPerSeverityUnit": 0.0167}, {"code": "HARSH_BRAKING", "pillar": "SAFETY", "threshold": 150, "maxDeduction": 20, "deductionPerSeverityUnit": 0.25}, {"code": "HARSH_CORNERING", "pillar": "SAFETY", "threshold": 150, "maxDeduction": 20, "deductionPerSeverityUnit": 0.25}, {"code": "EXCESSIVE_IDLING", "pillar": "EFFICIENCY", "maxDeduction": 15, "deductionPer100Km": 5}, {"code": "HARSH_ACCELERATION", "pillar": "EFFICIENCY", "threshold": 120, "maxDeduction": 10, "deductionPerSeverityUnit": 0.20}, {"code": "HIGH_RPM", "pillar": "ASSET_CARE", "threshold": 2000, "maxDeduction": 55, "maxThreshold": 3000, "deductionPerSeverityUnit": 0.05}, {"code": "COLD_ENGINE_STRAIN", "pillar": "ASSET_CARE", "maxDeduction": 50, "deductionPerEvent": 10}, {"code": "HIGH_LOAD_STRAIN", "pillar": "ASSET_CARE", "maxDeduction": 35, "deductionPer100Km": 8}, {"code": "ENGINE_LUGGING", "pillar": "ASSET_CARE", "maxDeduction": 40, "deductionPer100Km": 15}, {"code": "DEVICE_UNPLUGGED", "pillar": "ASSET_CARE", "maxDeduction": 30, "deductionPerEvent": 10}], "pillars": {"SAFETY": {"weight": 0.4, "baseScore": 100}, "ASSET_CARE": {"weight": 0.5, "baseScore": 100}, "EFFICIENCY": {"weight": 0.1, "baseScore": 100}}, "engineVersion": "0.1"}', '2026-06-01 12:00:00.000', '2026-06-01 12:00:00.000');

INSERT INTO public."ScoringProfile" VALUES ('b8de8e80-8846-4674-96fc-42ca8b46f52e', NULL, 'DEFAULT_HDV_DIESEL', '{"rules": [{"code": "OVERSPEEDING", "pillar": "SAFETY", "threshold": 90, "maxDeduction": 20, "deductionPerSeverityUnit": 0.0167}, {"code": "HARSH_BRAKING", "pillar": "SAFETY", "threshold": 220, "maxDeduction": 20, "deductionPerSeverityUnit": 0.25}, {"code": "HARSH_CORNERING", "pillar": "SAFETY", "threshold": 200, "maxDeduction": 20, "deductionPerSeverityUnit": 0.25}, {"code": "EXCESSIVE_IDLING", "pillar": "EFFICIENCY", "maxDeduction": 15, "deductionPer100Km": 5}, {"code": "HARSH_ACCELERATION", "pillar": "EFFICIENCY", "threshold": 180, "maxDeduction": 10, "deductionPerSeverityUnit": 0.20}, {"code": "HIGH_RPM", "pillar": "ASSET_CARE", "threshold": 1650, "maxDeduction": 55, "maxThreshold": 2200, "deductionPerSeverityUnit": 0.05}, {"code": "COLD_ENGINE_STRAIN", "pillar": "ASSET_CARE", "maxDeduction": 50, "deductionPerEvent": 10}, {"code": "HIGH_LOAD_STRAIN", "pillar": "ASSET_CARE", "maxDeduction": 35, "deductionPer100Km": 8}, {"code": "ENGINE_LUGGING", "pillar": "ASSET_CARE", "maxDeduction": 40, "deductionPer100Km": 15}, {"code": "DEVICE_UNPLUGGED", "pillar": "ASSET_CARE", "maxDeduction": 30, "deductionPerEvent": 10}], "pillars": {"SAFETY": {"weight": 0.4, "baseScore": 100}, "ASSET_CARE": {"weight": 0.5, "baseScore": 100}, "EFFICIENCY": {"weight": 0.1, "baseScore": 100}}, "engineVersion": "0.1"}', '2026-06-01 12:00:00.000', '2026-06-01 12:00:00.000');

INSERT INTO public."ScoringProfile" VALUES ('b8de8e80-8846-4674-96fc-42ca8b46f52f', NULL, 'DEFAULT_LCV_DIESEL', '{"rules": [{"code": "OVERSPEEDING", "pillar": "SAFETY", "threshold": 100, "maxDeduction": 20, "deductionPerSeverityUnit": 0.0167}, {"code": "HARSH_BRAKING", "pillar": "SAFETY", "threshold": 300, "maxDeduction": 20, "deductionPerSeverityUnit": 0.25}, {"code": "HARSH_CORNERING", "pillar": "SAFETY", "threshold": 250, "maxDeduction": 20, "deductionPerSeverityUnit": 0.25}, {"code": "EXCESSIVE_IDLING", "pillar": "EFFICIENCY", "maxDeduction": 15, "deductionPer100Km": 5}, {"code": "HARSH_ACCELERATION", "pillar": "EFFICIENCY", "threshold": 220, "maxDeduction": 10, "deductionPerSeverityUnit": 0.20}, {"code": "HIGH_RPM", "pillar": "ASSET_CARE", "threshold": 2300, "maxDeduction": 55, "maxThreshold": 3200, "deductionPerSeverityUnit": 0.05}, {"code": "COLD_ENGINE_STRAIN", "pillar": "ASSET_CARE", "maxDeduction": 50, "deductionPerEvent": 10}, {"code": "HIGH_LOAD_STRAIN", "pillar": "ASSET_CARE", "maxDeduction": 35, "deductionPer100Km": 8}, {"code": "ENGINE_LUGGING", "pillar": "ASSET_CARE", "maxDeduction": 40, "deductionPer100Km": 15}, {"code": "DEVICE_UNPLUGGED", "pillar": "ASSET_CARE", "maxDeduction": 30, "deductionPerEvent": 10}], "pillars": {"SAFETY": {"weight": 0.4, "baseScore": 100}, "ASSET_CARE": {"weight": 0.5, "baseScore": 100}, "EFFICIENCY": {"weight": 0.1, "baseScore": 100}}, "engineVersion": "0.1"}', '2026-06-01 12:00:00.000', '2026-06-01 12:00:00.000');

INSERT INTO public."ScoringProfile" VALUES ('b8de8e80-8846-4674-96fc-42ca8b46f530', NULL, 'DEFAULT_PASSENGER_DIESEL', '{"rules": [{"code": "OVERSPEEDING", "pillar": "SAFETY", "threshold": 110, "maxDeduction": 20, "deductionPerSeverityUnit": 0.0167}, {"code": "HARSH_BRAKING", "pillar": "SAFETY", "threshold": 400, "maxDeduction": 20, "deductionPerSeverityUnit": 0.25}, {"code": "HARSH_CORNERING", "pillar": "SAFETY", "threshold": 380, "maxDeduction": 20, "deductionPerSeverityUnit": 0.25}, {"code": "EXCESSIVE_IDLING", "pillar": "EFFICIENCY", "maxDeduction": 15, "deductionPer100Km": 5}, {"code": "HARSH_ACCELERATION", "pillar": "EFFICIENCY", "threshold": 250, "maxDeduction": 10, "deductionPerSeverityUnit": 0.20}, {"code": "HIGH_RPM", "pillar": "ASSET_CARE", "threshold": 2500, "maxDeduction": 55, "maxThreshold": 3500, "deductionPerSeverityUnit": 0.05}, {"code": "COLD_ENGINE_STRAIN", "pillar": "ASSET_CARE", "maxDeduction": 50, "deductionPerEvent": 10}, {"code": "HIGH_LOAD_STRAIN", "pillar": "ASSET_CARE", "maxDeduction": 35, "deductionPer100Km": 8}, {"code": "ENGINE_LUGGING", "pillar": "ASSET_CARE", "maxDeduction": 40, "deductionPer100Km": 15}, {"code": "DEVICE_UNPLUGGED", "pillar": "ASSET_CARE", "maxDeduction": 30, "deductionPerEvent": 10}], "pillars": {"SAFETY": {"weight": 0.4, "baseScore": 100}, "ASSET_CARE": {"weight": 0.5, "baseScore": 100}, "EFFICIENCY": {"weight": 0.1, "baseScore": 100}}, "engineVersion": "0.1"}', '2026-06-01 12:00:00.000', '2026-06-01 12:00:00.000');

ALTER TABLE public."ScoringProfile" ENABLE TRIGGER ALL;

--
-- Data for Name: Vehicle; Type: TABLE DATA; Schema: public; Owner: postgres
--

ALTER TABLE public."Vehicle" DISABLE TRIGGER ALL;

INSERT INTO public."Vehicle" ("id", "orgId", "imei", "alias", "plateNumber", "vin", "make", "model", "year", "status", "scoringProfileId", "createdAt", "isListed") VALUES ('a33739e8-e620-48d2-bef0-b1c2f83d039a', 'ada2c63b-3369-47e3-9934-6cc8d6498fb3', '865124071453916', 'Unidad 1', 'EC7850', '3N1CN8AE2ZL111904', 'Nissan', 'Versa', 2023, 'ACTIVE', 'f5098e80-8846-4674-96fc-42ca8b46f52c', '2026-05-17 19:53:35.046', true);

ALTER TABLE public."Vehicle" ENABLE TRIGGER ALL;

--
-- PostgreSQL database dump complete
--

