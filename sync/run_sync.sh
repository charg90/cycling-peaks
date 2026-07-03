#!/bin/bash
cd /home/carlos/projects/cycling-peaks/sync
export GARMIN_EMAIL='longa199@hotmail.com'
export GARMIN_PASSWORD='Carolita1'
python3 -c "
import os, sys
sys.path.insert(0, '.')
from main import main
main()
" 2>&1