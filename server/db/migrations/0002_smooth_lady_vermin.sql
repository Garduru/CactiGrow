CREATE TABLE "bred_seeds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_player_id" uuid NOT NULL,
	"clone_line_id" uuid NOT NULL,
	"parent_1_specimen_id" uuid NOT NULL,
	"parent_2_specimen_id" uuid NOT NULL,
	"parent_1_species_id" text NOT NULL,
	"parent_2_species_id" text NOT NULL,
	"is_hybrid" boolean NOT NULL,
	"genetic_features" jsonb NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"planted_at" timestamp with time zone,
	"planted_specimen_id" uuid,
	CONSTRAINT "bred_seeds_clone_line_id_unique" UNIQUE("clone_line_id"),
	CONSTRAINT "bred_seeds_planted_specimen_id_unique" UNIQUE("planted_specimen_id"),
	CONSTRAINT "bred_seeds_distinct_parents" CHECK ("bred_seeds"."parent_1_specimen_id" <> "bred_seeds"."parent_2_specimen_id"),
	CONSTRAINT "bred_seeds_status_valid" CHECK (("bred_seeds"."status" = 'available' AND "bred_seeds"."planted_at" IS NULL AND "bred_seeds"."planted_specimen_id" IS NULL) OR ("bred_seeds"."status" = 'planted' AND "bred_seeds"."planted_at" IS NOT NULL AND "bred_seeds"."planted_specimen_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "bred_seeds" ADD CONSTRAINT "bred_seeds_owner_player_id_players_id_fk" FOREIGN KEY ("owner_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bred_seeds" ADD CONSTRAINT "bred_seeds_clone_line_id_clone_lines_id_fk" FOREIGN KEY ("clone_line_id") REFERENCES "public"."clone_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bred_seeds" ADD CONSTRAINT "bred_seeds_parent_1_specimen_id_plant_specimens_id_fk" FOREIGN KEY ("parent_1_specimen_id") REFERENCES "public"."plant_specimens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bred_seeds" ADD CONSTRAINT "bred_seeds_parent_2_specimen_id_plant_specimens_id_fk" FOREIGN KEY ("parent_2_specimen_id") REFERENCES "public"."plant_specimens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bred_seeds" ADD CONSTRAINT "bred_seeds_planted_specimen_id_plant_specimens_id_fk" FOREIGN KEY ("planted_specimen_id") REFERENCES "public"."plant_specimens"("id") ON DELETE no action ON UPDATE no action;