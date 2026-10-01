CREATE TABLE "friend_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_player_id" uuid NOT NULL,
	"to_player_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friend_requests_distinct_players" CHECK ("friend_requests"."from_player_id" <> "friend_requests"."to_player_id"),
	CONSTRAINT "friend_requests_status_valid" CHECK ("friend_requests"."status" IN ('pending', 'accepted', 'declined', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"player_low_id" uuid NOT NULL,
	"player_high_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_player_low_id_player_high_id_pk" PRIMARY KEY("player_low_id","player_high_id"),
	CONSTRAINT "friendships_ordered_distinct_players" CHECK ("friendships"."player_low_id" < "friendships"."player_high_id")
);
--> statement-breakpoint
CREATE TABLE "player_blocks" (
	"blocker_player_id" uuid NOT NULL,
	"blocked_player_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_blocks_blocker_player_id_blocked_player_id_pk" PRIMARY KEY("blocker_player_id","blocked_player_id"),
	CONSTRAINT "player_blocks_distinct_players" CHECK ("player_blocks"."blocker_player_id" <> "player_blocks"."blocked_player_id")
);
--> statement-breakpoint
CREATE TABLE "player_profiles" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"display_name" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_profiles_display_name_valid" CHECK ("player_profiles"."display_name" = btrim("player_profiles"."display_name") AND "player_profiles"."display_name" ~ '^[[:alnum:] _-]{3,20}$')
);
--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_from_player_id_players_id_fk" FOREIGN KEY ("from_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_to_player_id_players_id_fk" FOREIGN KEY ("to_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_player_low_id_players_id_fk" FOREIGN KEY ("player_low_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_player_high_id_players_id_fk" FOREIGN KEY ("player_high_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_blocks" ADD CONSTRAINT "player_blocks_blocker_player_id_players_id_fk" FOREIGN KEY ("blocker_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_blocks" ADD CONSTRAINT "player_blocks_blocked_player_id_players_id_fk" FOREIGN KEY ("blocked_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "friend_requests_pending_pair_unique" ON "friend_requests" USING btree (LEAST("from_player_id", "to_player_id"),GREATEST("from_player_id", "to_player_id")) WHERE "friend_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "friend_requests_to_status_index" ON "friend_requests" USING btree ("to_player_id","status");--> statement-breakpoint
CREATE INDEX "friend_requests_from_status_index" ON "friend_requests" USING btree ("from_player_id","status");--> statement-breakpoint
CREATE INDEX "friendships_high_player_index" ON "friendships" USING btree ("player_high_id");--> statement-breakpoint
CREATE INDEX "player_blocks_blocked_player_index" ON "player_blocks" USING btree ("blocked_player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_profiles_public_id_unique" ON "player_profiles" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_profiles_display_name_lower_unique" ON "player_profiles" USING btree (lower("display_name"));