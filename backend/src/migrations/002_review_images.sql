-- Customer photos attached to reviews (moderated together with the review).
CREATE TABLE review_images (
  id          serial PRIMARY KEY,
  review_id   int NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  thumb       text NOT NULL,              -- uploads-relative path, square 320px WebP
  full_path   text NOT NULL,              -- uploads-relative path, ≤1400px WebP
  width       int NOT NULL DEFAULT 0,
  height      int NOT NULL DEFAULT 0,
  position    smallint NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX review_images_review_idx ON review_images (review_id, position);
