import controllers.refresh
import os
import sys

os.environ['TZ'] = 'US/Eastern'

job = sys.argv[1]

if job == 'changeme':
    pass