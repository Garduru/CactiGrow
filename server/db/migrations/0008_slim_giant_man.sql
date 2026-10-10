CREATE TABLE "wild_genetic_seeds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_player_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"clone_line_id" uuid NOT NULL,
	"provenance" jsonb NOT NULL,
	"source_genetics" jsonb NOT NULL,
	"genetic_features" jsonb NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"planted_at" timestamp with time zone,
	"planted_specimen_id" uuid,
	CONSTRAINT "wild_genetic_seeds_clone_line_id_unique" UNIQUE("clone_line_id"),
	CONSTRAINT "wild_genetic_seeds_planted_specimen_id_unique" UNIQUE("planted_specimen_id"),
	CONSTRAINT "wild_genetic_seeds_lot_ordinal_unique" UNIQUE("owner_player_id","lot_id","ordinal"),
	CONSTRAINT "wild_genetic_seeds_ordinal_bounded" CHECK ("wild_genetic_seeds"."ordinal" BETWEEN 0 AND 9),
	CONSTRAINT "wild_genetic_seeds_status_valid" CHECK (("wild_genetic_seeds"."status" = 'available' AND "wild_genetic_seeds"."planted_at" IS NULL AND "wild_genetic_seeds"."planted_specimen_id" IS NULL) OR ("wild_genetic_seeds"."status" = 'planted' AND "wild_genetic_seeds"."planted_at" IS NOT NULL AND "wild_genetic_seeds"."planted_specimen_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "wild_genetic_seeds" ADD CONSTRAINT "wild_genetic_seeds_owner_player_id_players_id_fk" FOREIGN KEY ("owner_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wild_genetic_seeds" ADD CONSTRAINT "wild_genetic_seeds_clone_line_id_clone_lines_id_fk" FOREIGN KEY ("clone_line_id") REFERENCES "public"."clone_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wild_genetic_seeds" ADD CONSTRAINT "wild_genetic_seeds_planted_specimen_id_plant_specimens_id_fk" FOREIGN KEY ("planted_specimen_id") REFERENCES "public"."plant_specimens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wild_genetic_seeds_owner_idx" ON "wild_genetic_seeds" USING btree ("owner_player_id");