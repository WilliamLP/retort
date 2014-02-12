from sqlalchemy import *

metadata = MetaData()

example = Table('example', metadata,
    Column('id', Integer, primary_key=True),
    Column('acolumn', Integer),

    Index('i1', 'acolumn', unique=True)
)
