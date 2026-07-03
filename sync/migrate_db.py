import sqlite3
conn = sqlite3.connect('/home/carlos/projects/cycling-peaks/backend/cycling.db')
conn.execute('ALTER TABLE workouts ADD COLUMN best_30s INTEGER DEFAULT 0')
conn.execute('ALTER TABLE workouts ADD COLUMN best_5min INTEGER DEFAULT 0')
conn.execute('ALTER TABLE workouts ADD COLUMN best_20min INTEGER DEFAULT 0')
conn.commit()
print('Migration done')
conn.close()