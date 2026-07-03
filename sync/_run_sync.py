import os
import sys
sys.path.insert(0, '.')

os.environ['GARMIN_EMAIL'] = 'longa199@hotmail.com'
os.environ['GARMIN_PASSWORD'] = 'Carolita1'

from main import run_sync
run_sync()