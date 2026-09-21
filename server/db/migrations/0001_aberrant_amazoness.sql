CREATE TABLE "clone_line_variants" (
	"clone_line_id" uuid NOT NULL,
	"variant_id" text NOT NULL,
	"origin" text NOT NULL,
	"established_at" timestamp with time zone NOT NULL,
	CONSTRAINT "clone_line_variants_clone_line_id_variant_id_pk" PRIMARY KEY("clone_line_id","variant_id")
);
--> statement-breakpoint
CREATE TABLE "clone_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"species_id" text NOT NULL,
	"origin_type" text NOT NULL,
	"origin_player_id" uuid NOT NULL,
	"established_at" timestamp with time zone NOT NULL,
	"genetic_representation_version" integer NOT NULL,
	"visual_derivation_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clone_lines_versions_positive" CHECK ("clone_lines"."genetic_representation_version" >= 1 AND "clone_lines"."visual_derivation_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "gameplay_command_receipts" (
	"player_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"command_type" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"status" text NOT NULL,
	"response_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "gameplay_command_receipts_player_id_idempotency_key_pk" PRIMARY KEY("player_id","idempotency_key"),
	CONSTRAINT "gameplay_command_receipts_status_valid" CHECK ("gameplay_command_receipts"."status" IN ('processing','completed')),
	CONSTRAINT "gameplay_command_receipts_completed_shape" CHECK ("gameplay_command_receipts"."status" <> 'completed' OR ("gameplay_command_receipts"."response_payload" IS NOT NULL AND "gameplay_command_receipts"."completed_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "genetic_profiles" (
	"clone_line_id" uuid PRIMARY KEY NOT NULL,
	"vigor" integer NOT NULL,
	"growth_speed" integer NOT NULL,
	"size" integer NOT NULL,
	"flowering" integer NOT NULL,
	"mutation_chance" integer NOT NULL,
	"establishment_rule_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "genetic_profiles_ratings_bounded" CHECK ("genetic_profiles"."vigor" BETWEEN 0 AND 100 AND "genetic_profiles"."growth_speed" BETWEEN 0 AND 100 AND "genetic_profiles"."size" BETWEEN 0 AND 100 AND "genetic_profiles"."flowering" BETWEEN 0 AND 100 AND "genetic_profiles"."mutation_chance" BETWEEN 0 AND 100),
	CONSTRAINT "genetic_profiles_rule_positive" CHECK ("genetic_profiles"."establishment_rule_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "nursery_occupancies" (
	"player_id" uuid NOT NULL,
	"slot_id" text NOT NULL,
	"specimen_id" uuid NOT NULL,
	"planted_at" timestamp with time zone NOT NULL,
	"ready_at" timestamp with time zone NOT NULL,
	"growth_rule_version" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nursery_occupancies_player_id_slot_id_pk" PRIMARY KEY("player_id","slot_id"),
	CONSTRAINT "nursery_occupancies_specimen_unique" UNIQUE("specimen_id"),
	CONSTRAINT "nursery_occupancies_owner_specimen_unique" UNIQUE("player_id","specimen_id"),
	CONSTRAINT "nursery_occupancies_slot_valid" CHECK ("nursery_occupancies"."slot_id" IN ('slot-1','slot-2','slot-3','slot-4','slot-5','slot-6')),
	CONSTRAINT "nursery_occupancies_schedule_valid" CHECK ("nursery_occupancies"."ready_at" > "nursery_occupancies"."planted_at"),
	CONSTRAINT "nursery_occupancies_versions_positive" CHECK ("nursery_occupancies"."growth_rule_version" >= 1 AND "nursery_occupancies"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "plant_specimens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_player_id" uuid NOT NULL,
	"clone_line_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"lifecycle_status" text NOT NULL,
	"planted_at" timestamp with time zone NOT NULL,
	"collected_at" timestamp with time zone,
	"visual_derivation_version" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plant_specimens_owner_id_unique" UNIQUE("owner_player_id","id"),
	CONSTRAINT "plant_specimens_lifecycle_valid" CHECK (("plant_specimens"."lifecycle_status" = 'growing' AND "plant_specimens"."collected_at" IS NULL) OR ("plant_specimens"."lifecycle_status" = 'owned' AND "plant_specimens"."collected_at" IS NOT NULL)),
	CONSTRAINT "plant_specimens_versions_positive" CHECK ("plant_specimens"."visual_derivation_version" >= 1 AND "plant_specimens"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "player_plant_lifecycle_versions" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_plant_lifecycle_versions_nonnegative" CHECK ("player_plant_lifecycle_versions"."version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "player_seed_stacks" (
	"player_id" uuid NOT NULL,
	"species_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_seed_stacks_player_id_species_id_pk" PRIMARY KEY("player_id","species_id"),
	CONSTRAINT "player_seed_stacks_quantity_nonnegative" CHECK ("player_seed_stacks"."quantity" >= 0),
	CONSTRAINT "player_seed_stacks_version_positive" CHECK ("player_seed_stacks"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "clone_line_variants" ADD CONSTRAINT "clone_line_variants_clone_line_id_clone_lines_id_fk" FOREIGN KEY ("clone_line_id") REFERENCES "public"."clone_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clone_lines" ADD CONSTRAINT "clone_lines_origin_player_id_players_id_fk" FOREIGN KEY ("origin_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gameplay_command_receipts" ADD CONSTRAINT "gameplay_command_receipts_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "genetic_profiles" ADD CONSTRAINT "genetic_profiles_clone_line_id_clone_lines_id_fk" FOREIGN KEY ("clone_line_id") REFERENCES "public"."clone_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nursery_occupancies" ADD CONSTRAINT "nursery_occupancies_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nursery_occupancies" ADD CONSTRAINT "nursery_occupancies_owned_specimen_fk" FOREIGN KEY ("player_id","specimen_id") REFERENCES "public"."plant_specimens"("owner_player_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plant_specimens" ADD CONSTRAINT "plant_specimens_owner_player_id_players_id_fk" FOREIGN KEY ("owner_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plant_specimens" ADD CONSTRAINT "plant_specimens_clone_line_id_clone_lines_id_fk" FOREIGN KEY ("clone_line_id") REFERENCES "public"."clone_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_plant_lifecycle_versions" ADD CONSTRAINT "player_plant_lifecycle_versions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_seed_stacks" ADD CONSTRAINT "player_seed_stacks_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;