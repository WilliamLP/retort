import os

# Get config from os environ vars if they are set, since this is the Heroku way.
# I'd like to use a .env file for local testing, but it's not easily supported by my tools right now.

local_config = {
    'DATABASE_URL': 'postgres://william:william@localhost/changeme',
    'FLASK_SECRET': 'shhhdonttell!'
}

config = {}
for key in local_config.keys():
    config[key] = os.environ.get(key, local_config[key])
