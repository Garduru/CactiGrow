CREATE TABLE "mail_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sender_player_id" uuid NOT NULL,
	"recipient_player_id" uuid NOT NULL,
	"command_id" uuid NOT NULL,
	"request_fingerprint" text NOT NULL,
	"subject" text NOT NULL,
	"text" text NOT NULL,
	"attachment" jsonb,
	"specimen_id" uuid,
	"sent_at" timestamp with time zone NOT NULL,
	"read_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	CONSTRAINT "mail_messages_sender_command_unique" UNIQUE("sender_player_id","command_id"),
	CONSTRAINT "mail_messages_distinct_players" CHECK ("mail_messages"."sender_player_id" <> "mail_messages"."recipient_player_id"),
	CONSTRAINT "mail_messages_text_bounded" CHECK (length("mail_messages"."subject") BETWEEN 1 AND 80 AND length("mail_messages"."text") BETWEEN 1 AND 2000),
	CONSTRAINT "mail_messages_claim_valid" CHECK ("mail_messages"."claimed_at" IS NULL OR "mail_messages"."attachment" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_sender_player_id_players_id_fk" FOREIGN KEY ("sender_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_recipient_player_id_players_id_fk" FOREIGN KEY ("recipient_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_specimen_id_plant_specimens_id_fk" FOREIGN KEY ("specimen_id") REFERENCES "public"."plant_specimens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mail_messages_pending_specimen_unique" ON "mail_messages" USING btree ("specimen_id") WHERE "mail_messages"."claimed_at" IS NULL AND "mail_messages"."specimen_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "mail_messages_inbox_idx" ON "mail_messages" USING btree ("recipient_player_id","sent_at");--> statement-breakpoint
CREATE INDEX "mail_messages_sent_idx" ON "mail_messages" USING btree ("sender_player_id","sent_at");