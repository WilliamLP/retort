from nose.tools import *
import sqlalchemy.exc

import config_test
import db

class test_db:
    def setup(self):
        db.drop_all()
        db.create_all()

    @raises(sqlalchemy.exc.ProgrammingError)
    def test_drop_all(self):
        db.drop_all()
        db.rows('select * from data')

    def test_create_all(self):
        db.create_all()
        assert_equal([], db.rows('select * from data'))

    def test_insert(self):
        row_dict = {'type': 'weight'}
        returned = db.insert('data', row_dict)

        assert_equal(returned, row_dict)
        assert_equal(1, row_dict['id'])

        row = db.row('select * from data')

        assert_equal(1, row['id'])
        assert_equal('weight', row['type'])

    def test_update(self):
        row = db.insert('data', {'type': 'weight'})

        row['value'] = 150
        db.update('data', row)

        row2 = db.row('select * from data')
        assert_equal(150, row2['value'])

    def test_delete(self):
        row_dict = {'type': 'weight'}
        row_dict = db.insert('data', row_dict)
        db.delete('data', row_dict)

        assert_equal(None, row_dict.get('id'))
        assert_equal([], db.rows('select * from data'))


    def test_rows(self):
        for i in range(5):
            db.insert('data', {'type': 'weight'})
        assert_equal(5, len(db.rows('select * from data')))

    def test_row(self):
        db.insert('data', {'type': 'weight'})
        row = db.row('select id, type from data')
        assert_equal({'id': 1, 'type': 'weight'}, row)

    def test_execute(self):
        db.execute('insert into data (type) values (%s)', 'weight')
        row = db.row('select id, type from data')
        assert_equal({'id': 1, 'type': 'weight'}, row)
