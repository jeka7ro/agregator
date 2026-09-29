DELETE FROM competitor_products WHERE restaurant_id IS NOT NULL AND restaurant_id NOT IN (SELECT id FROM competitor_restaurants);
DELETE FROM competitor_products WHERE competitor_restaurant_id IS NOT NULL AND competitor_restaurant_id NOT IN (SELECT id FROM competitor_restaurants);
DELETE FROM competitor_restaurants WHERE snapshot_id NOT IN (SELECT id FROM competitor_snapshots);
