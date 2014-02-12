# A naive experimental micro-framework wrapper around SQLAlchemy to give
# a simple abstraction of rows as dictionaries, sacrificing a lot of
# control and power.
#
# This can be considered a really crude dictionary-relational-mapper.
#
# All tables are assumed to have a single primary key named "id".
#
# Scare words from the SQLAlchemy docs saying not to do what I'm doing:
# """
# While "bound metadata" has a marginal level of usefulness with regards
# to ORM configuration, "implicit execution" is a very old usage pattern
# that in most cases is more confusing than it is helpful, and its usage is
# discouraged. Both patterns seem to encourage the overuse of expedient
# "short cuts" in application design which lead to problems later on.
# """
#
# We'll see how painful these so-called "short cuts" become in this app.;)

import os
from sqlalchemy import *

import config
import tables

_engine = create_engine(config.config['DATABASE_URL'])
tables.metadata.bind = _engine

def create_all():
    '''
    To be used manually, so that tables.py is our schema management system.
    '''
    tables.metadata.create_all()

def drop_all():
    tables.metadata.drop_all()

def insert(table_name, value_dict):
    '''
    Inserts a new row, fills in the 'id' in the passed in value_dict
    (You could argue it's a dubious decision to mutate a parameter.)
    '''
    table = getattr(tables, table_name)
    result = table.insert().execute(value_dict)
    value_dict['id'] = result.inserted_primary_key[0]
    return value_dict

def update(table_name, value_dict):
    '''
    Updates a single row. Assumes value_dict has the primary key set.
    '''
    table = getattr(tables, table_name)
    table.update(values=value_dict).where(table.c.id == value_dict['id']).execute()
    return value_dict

def delete(table_name, value_dict):
    table = getattr(tables, table_name)
    table.delete().where(table.c.id == value_dict['id']).execute()
    del(value_dict['id'])

def rows(sql, *multiparams):
    '''
    Returns rows as dictionaries
    '''
    res = _engine.execute(sql, *multiparams)
    return [dict(row) for row in res]

def row(sql, *multiparams):
    rws = rows(sql, *multiparams)

    if len(rws) > 1:
        raise Exception(
            'Expected a single row (found %s) for query: %s' % (len(rws), sql))
    return None if len(rws) == 0 else rws[0]

def execute(sql, *multiparams):
    _engine.execute(sql, *multiparams)
