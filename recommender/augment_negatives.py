# augment_negatives.py (run after building surprise_ratings.csv)
import pandas as pd
import random
from tqdm import tqdm

RATINGS_CSV = "ml/recommender/data/surprise_ratings.csv"
OUT_CSV = "ml/recommender/data/surprise_ratings_with_neg.csv"
NEG_PER_USER = 5  # tune

df = pd.read_csv(RATINGS_CSV)
users = df['user_id'].unique().tolist()
items = df['item_id'].unique().tolist()

# build set of positive interactions
pos = set((u,i) for u,i in zip(df['user_id'], df['item_id']))

neg_rows = []
for u in tqdm(users):
    neg_count = 0
    trials = 0
    while neg_count < NEG_PER_USER and trials < NEG_PER_USER * 50:
        trials += 1
        item = random.choice(items)
        if (str(u), str(item)) not in pos:
            neg_rows.append({'user_id': str(u), 'item_id': str(item), 'rating': 0})
            neg_count += 1

neg_df = pd.DataFrame(neg_rows)
out = pd.concat([df, neg_df], ignore_index=True)
# shuffle (optional)
out = out.sample(frac=1, random_state=42).reset_index(drop=True)
out.to_csv(OUT_CSV, index=False)
print("WROTE", OUT_CSV, "rows:", len(out))
