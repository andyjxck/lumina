-- Trade Ratings System Migration
-- Adds rating functionality for completed trades

-- Create trade_ratings table
CREATE TABLE IF NOT EXISTS trade_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES trade_requests(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL REFERENCES ac_users(id) ON DELETE CASCADE,
  rated_id uuid NOT NULL REFERENCES ac_users(id) ON DELETE CASCADE,
  stars int NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(trade_id, rater_id) -- One rating per trade per rater
);

-- Add rating columns to ac_users
ALTER TABLE ac_users 
ADD COLUMN IF NOT EXISTS avg_rating numeric(3,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS rating_count int DEFAULT 0;

-- Function to update user's average rating
CREATE OR REPLACE FUNCTION update_user_rating(user_uuid uuid)
RETURNS void AS $$
DECLARE
  avg_rating numeric(3,2);
  rating_count int;
BEGIN
  SELECT 
    COALESCE(AVG(stars), 0)::numeric(3,2),
    COUNT(*)
  INTO avg_rating, rating_count
  FROM trade_ratings 
  WHERE rated_id = user_uuid;
  
  UPDATE ac_users 
  SET 
    avg_rating = CASE WHEN rating_count > 0 THEN avg_rating ELSE NULL END,
    rating_count = rating_count
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update ratings when a rating is inserted or updated
CREATE OR REPLACE FUNCTION trigger_update_user_rating()
RETURNS trigger AS $$
BEGIN
  PERFORM update_user_rating(NEW.rated_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trade_ratings_update_user_rating ON trade_ratings;
CREATE TRIGGER trade_ratings_update_user_rating
  AFTER INSERT OR UPDATE ON trade_ratings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_user_rating();

-- Trigger to update when a rating is deleted
CREATE OR REPLACE FUNCTION trigger_update_user_rating_delete()
RETURNS trigger AS $$
BEGIN
  PERFORM update_user_rating(OLD.rated_id);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trade_ratings_update_user_rating_delete ON trade_ratings;
CREATE TRIGGER trade_ratings_update_user_rating_delete
  AFTER DELETE ON trade_ratings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_user_rating_delete();

-- Enable RLS
ALTER TABLE trade_ratings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view ratings for trades they participated in"
  ON trade_ratings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trade_requests 
      WHERE id = trade_id 
      AND (requester_id = auth.uid() OR acceptor_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert ratings for their completed trades"
  ON trade_ratings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trade_requests 
      WHERE id = trade_id 
      AND status = 'completed'
      AND (requester_id = auth.uid() OR acceptor_id = auth.uid())
      AND rater_id = auth.uid()
      AND rated_id != auth.uid()
    )
  );

CREATE POLICY "Users can update their own ratings"
  ON trade_ratings FOR UPDATE
  USING (rater_id = auth.uid())
  WITH CHECK (rater_id = auth.uid());

CREATE POLICY "Users can delete their own ratings"
  ON trade_ratings FOR DELETE
  USING (rater_id = auth.uid());
