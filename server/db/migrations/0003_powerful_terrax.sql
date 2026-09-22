CREATE TABLE "player_onboarding" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"initialized_at" timestamp with time zone DEFAULT now() NOT NULL,
	"starter_granted_at" timestamp with time zone,
	"tutorial_started_at" timestamp with time zone,
	"tutorial_completed_at" timestamp with time zone,
	"cultivation_xp" integer DEFAULT 0 NOT NULL,
	"token_balance" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "player_onboarding_cultivation_xp_nonnegative" CHECK ("player_onboarding"."cultivation_xp" >= 0),
	CONSTRAINT "player_onboarding_token_balance_nonnegative" CHECK ("player_onboarding"."token_balance" >= 0)
);
--> statement-breakpoint
ALTER TABLE "player_onboarding" ADD CONSTRAINT "player_onboarding_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;