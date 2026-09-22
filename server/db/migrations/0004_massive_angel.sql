CREATE TABLE "bred_seed_treatments" (
	"seed_id" uuid PRIMARY KEY NOT NULL,
	"owner_player_id" uuid NOT NULL,
	"treatment" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_listings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seller_player_id" uuid NOT NULL,
	"specimen_id" uuid NOT NULL,
	"asking_price" integer NOT NULL,
	"status" text NOT NULL,
	"buyer_player_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "marketplace_listings_price_valid" CHECK ("marketplace_listings"."asking_price" BETWEEN 1 AND 1000000),
	CONSTRAINT "marketplace_listings_status_valid" CHECK ("marketplace_listings"."status" IN ('active','cancelled','sold'))
);
--> statement-breakpoint
CREATE TABLE "player_garden_displays" (
	"player_id" uuid NOT NULL,
	"slot_id" text NOT NULL,
	"specimen_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_garden_displays_player_id_slot_id_pk" PRIMARY KEY("player_id","slot_id"),
	CONSTRAINT "player_garden_displays_specimen_unique" UNIQUE("player_id","specimen_id"),
	CONSTRAINT "player_garden_displays_slot_valid" CHECK ("player_garden_displays"."slot_id" IN ('garden-display-back-left','garden-display-back-center','garden-display-back-right','garden-display-front-left','garden-display-front-center','garden-display-front-right'))
);
--> statement-breakpoint
CREATE TABLE "player_garden_specimens" (
	"player_id" uuid NOT NULL,
	"specimen_id" uuid NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_garden_specimens_player_id_specimen_id_pk" PRIMARY KEY("player_id","specimen_id")
);
--> statement-breakpoint
CREATE TABLE "player_grower_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"player_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"source_command_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "player_grower_events_source_unique" UNIQUE("player_id","source_command_id","event_type")
);
--> statement-breakpoint
CREATE TABLE "player_grower_state" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"achievements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"discoveries" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"journal_stats" jsonb DEFAULT '{"shinyCloneLineIds":[]}'::jsonb NOT NULL,
	"research" jsonb DEFAULT '{"records":{},"completedDiscoveryMilestoneIds":[]}'::jsonb NOT NULL,
	"lab" jsonb NOT NULL,
	"property" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_grower_state_version_positive" CHECK ("player_grower_state"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "plant_specimens" DROP CONSTRAINT "plant_specimens_lifecycle_valid";--> statement-breakpoint
ALTER TABLE "nursery_occupancies" DROP CONSTRAINT "nursery_occupancies_slot_valid";--> statement-breakpoint
ALTER TABLE "player_onboarding" ADD COLUMN "breeding_xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_onboarding" ADD COLUMN "genetics_xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_onboarding" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "bred_seed_treatments" ADD CONSTRAINT "bred_seed_treatments_seed_id_bred_seeds_id_fk" FOREIGN KEY ("seed_id") REFERENCES "public"."bred_seeds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bred_seed_treatments" ADD CONSTRAINT "bred_seed_treatments_owner_player_id_players_id_fk" FOREIGN KEY ("owner_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_seller_player_id_players_id_fk" FOREIGN KEY ("seller_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_specimen_id_plant_specimens_id_fk" FOREIGN KEY ("specimen_id") REFERENCES "public"."plant_specimens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_buyer_player_id_players_id_fk" FOREIGN KEY ("buyer_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_garden_displays" ADD CONSTRAINT "player_garden_displays_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_garden_displays" ADD CONSTRAINT "player_garden_displays_specimen_id_plant_specimens_id_fk" FOREIGN KEY ("specimen_id") REFERENCES "public"."plant_specimens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_garden_specimens" ADD CONSTRAINT "player_garden_specimens_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_garden_specimens" ADD CONSTRAINT "player_garden_specimens_specimen_id_plant_specimens_id_fk" FOREIGN KEY ("specimen_id") REFERENCES "public"."plant_specimens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_grower_events" ADD CONSTRAINT "player_grower_events_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_grower_state" ADD CONSTRAINT "player_grower_state_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "marketplace_listings_active_specimen_unique" ON "marketplace_listings" USING btree ("specimen_id") WHERE "marketplace_listings"."status" = 'active';--> statement-breakpoint
ALTER TABLE "plant_specimens" ADD CONSTRAINT "plant_specimens_lifecycle_valid" CHECK (("plant_specimens"."lifecycle_status" = 'growing' AND "plant_specimens"."collected_at" IS NULL) OR ("plant_specimens"."lifecycle_status" IN ('owned','sold') AND "plant_specimens"."collected_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "nursery_occupancies" ADD CONSTRAINT "nursery_occupancies_slot_valid" CHECK ("nursery_occupancies"."slot_id" IN ('slot-1','slot-2','slot-3','slot-4','slot-5','slot-6','slot-7','slot-8'));--> statement-breakpoint
ALTER TABLE "player_onboarding" ADD CONSTRAINT "player_onboarding_breeding_xp_nonnegative" CHECK ("player_onboarding"."breeding_xp" >= 0);--> statement-breakpoint
ALTER TABLE "player_onboarding" ADD CONSTRAINT "player_onboarding_genetics_xp_nonnegative" CHECK ("player_onboarding"."genetics_xp" >= 0);--> statement-breakpoint
ALTER TABLE "player_onboarding" ADD CONSTRAINT "player_onboarding_version_positive" CHECK ("player_onboarding"."version" >= 1);
--> statement-breakpoint
INSERT INTO "player_grower_state" (
	"player_id", "achievements", "discoveries", "journal_stats", "research", "lab", "property", "version", "updated_at"
)
SELECT
	p."id",
	'[{"id":"first-planting"},{"id":"first-harvest"},{"id":"first-breed"},{"id":"first-npc-sale"},{"id":"first-market-listing"},{"id":"first-species-discovery"},{"id":"reach-cultivation-level-10"},{"id":"reach-cultivation-level-25"},{"id":"reach-cultivation-level-50"},{"id":"reach-cultivation-level-75"},{"id":"reach-cultivation-level-99"}]'::jsonb,
	COALESCE((
		SELECT jsonb_object_agg(observation.species_id, jsonb_build_object(
			'speciesId', observation.species_id,
			'firstDiscoveredAt', observation.discovered_at,
			'discoverySource', observation.discovery_source,
			'firstSourceRef', observation.source_ref
		))
		FROM (
			SELECT DISTINCT ON (source.species_id) source.species_id, source.discovered_at, source.discovery_source, source.source_ref
			FROM (
				SELECT stacks.species_id, stacks.created_at AS discovered_at, 'starter'::text AS discovery_source, 'seed-stack:' || stacks.species_id AS source_ref
				FROM player_seed_stacks stacks WHERE stacks.player_id = p.id
				UNION ALL
				SELECT lines.species_id, lines.established_at, CASE WHEN lines.origin_type = 'bred-seed' THEN 'breeding' ELSE 'unknown' END, lines.id::text
				FROM clone_lines lines WHERE lines.origin_player_id = p.id
			) source
			ORDER BY source.species_id, source.discovered_at
		) observation
	), '{}'::jsonb),
	jsonb_build_object('shinyCloneLineIds', COALESCE((
		SELECT jsonb_agg(variants.clone_line_id::text ORDER BY variants.established_at)
		FROM clone_line_variants variants
		JOIN clone_lines lines ON lines.id = variants.clone_line_id
		WHERE lines.origin_player_id = p.id AND variants.variant_id = 'shiny'
	), '[]'::jsonb)),
	'{"records":{},"completedDiscoveryMilestoneIds":[]}'::jsonb,
	'{"tier":0,"tissueSamples":[],"specimenSampling":{},"geneticExtracts":[],"extractionAttemptIds":[]}'::jsonb,
	jsonb_build_object(
		'buildings', jsonb_build_object(
			'home', jsonb_build_object('buildingId','home','level',1,'installedAt',now()),
			'nursery', jsonb_build_object('buildingId','nursery','level',1,'installedAt',now()),
			'garden', jsonb_build_object('buildingId','garden','level',1,'installedAt',now()),
			'shop', jsonb_build_object('buildingId','shop','level',1,'installedAt',now()),
			'market', jsonb_build_object('buildingId','market','level',1,'installedAt',now())
		),
		'completedUpgradeIds', '[]'::jsonb,
		'farmAccessPreference', 'nobody'
	),
	1,
	now()
FROM players p
ON CONFLICT (player_id) DO NOTHING;
--> statement-breakpoint
INSERT INTO player_grower_events (id, player_id, event_type, source_command_id, occurred_at, payload)
SELECT gen_random_uuid(), specimens.owner_player_id,
	CASE WHEN specimens.source_type = 'bred-seed' THEN 'plantBredSeed' ELSE 'plantSeed' END,
	specimens.id, specimens.planted_at,
	jsonb_build_object('specimenId', specimens.id, 'cloneLineId', specimens.clone_line_id)
FROM plant_specimens specimens
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO player_grower_events (id, player_id, event_type, source_command_id, occurred_at, payload)
SELECT gen_random_uuid(), specimens.owner_player_id, 'collectPlant', specimens.id, specimens.collected_at,
	jsonb_build_object('specimenId', specimens.id, 'cloneLineId', specimens.clone_line_id)
FROM plant_specimens specimens
WHERE specimens.collected_at IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO player_grower_events (id, player_id, event_type, source_command_id, occurred_at, payload)
SELECT gen_random_uuid(), seeds.owner_player_id, 'breedPlant', seeds.id, seeds.created_at,
	jsonb_build_object('seedId', seeds.id, 'cloneLineId', seeds.clone_line_id)
FROM bred_seeds seeds
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE player_onboarding onboarding
SET cultivation_xp = history.cultivation_xp,
	breeding_xp = history.breeding_xp,
	version = onboarding.version + 1
FROM (
	SELECT p.id AS player_id,
		COALESCE(SUM(CASE WHEN e.event_type = 'plantSeed' THEN 10 WHEN e.event_type = 'plantBredSeed' THEN 15 WHEN e.event_type = 'collectPlant' THEN 25 ELSE 0 END), 0)::integer AS cultivation_xp,
		COALESCE(SUM(CASE WHEN e.event_type = 'breedPlant' THEN 40 ELSE 0 END), 0)::integer AS breeding_xp
	FROM players p LEFT JOIN player_grower_events e ON e.player_id = p.id
	GROUP BY p.id
) history
WHERE onboarding.player_id = history.player_id;
--> statement-breakpoint
UPDATE player_grower_state state
SET achievements = (
	SELECT jsonb_agg(
		CASE
			WHEN achievement->>'id' = 'first-planting' AND EXISTS (SELECT 1 FROM player_grower_events e WHERE e.player_id = state.player_id AND e.event_type IN ('plantSeed','plantBredSeed')) THEN achievement || jsonb_build_object('completedAt', now())
			WHEN achievement->>'id' = 'first-harvest' AND EXISTS (SELECT 1 FROM player_grower_events e WHERE e.player_id = state.player_id AND e.event_type = 'collectPlant') THEN achievement || jsonb_build_object('completedAt', now())
			WHEN achievement->>'id' = 'first-breed' AND EXISTS (SELECT 1 FROM player_grower_events e WHERE e.player_id = state.player_id AND e.event_type = 'breedPlant') THEN achievement || jsonb_build_object('completedAt', now())
			WHEN achievement->>'id' = 'first-species-discovery' AND state.discoveries <> '{}'::jsonb THEN achievement || jsonb_build_object('completedAt', now())
			WHEN achievement->>'id' = 'reach-cultivation-level-10' AND (SELECT cultivation_xp FROM player_onboarding WHERE player_id = state.player_id) >= 1154 THEN achievement || jsonb_build_object('completedAt', now())
			WHEN achievement->>'id' = 'reach-cultivation-level-25' AND (SELECT cultivation_xp FROM player_onboarding WHERE player_id = state.player_id) >= 7842 THEN achievement || jsonb_build_object('completedAt', now())
			WHEN achievement->>'id' = 'reach-cultivation-level-50' AND (SELECT cultivation_xp FROM player_onboarding WHERE player_id = state.player_id) >= 101333 THEN achievement || jsonb_build_object('completedAt', now())
			WHEN achievement->>'id' = 'reach-cultivation-level-75' AND (SELECT cultivation_xp FROM player_onboarding WHERE player_id = state.player_id) >= 1210421 THEN achievement || jsonb_build_object('completedAt', now())
			WHEN achievement->>'id' = 'reach-cultivation-level-99' AND (SELECT cultivation_xp FROM player_onboarding WHERE player_id = state.player_id) >= 13034431 THEN achievement || jsonb_build_object('completedAt', now())
			ELSE achievement
		END
	)
	FROM jsonb_array_elements(state.achievements) achievement
), version = state.version + 1, updated_at = now();
