# Common code used by multiple controllers.

import config
import db
from datetime import date

class Redirect():
    def __init__(self, url_path):
        self.url_path = url_path

def redirect(url_path):
    '''
    A wrapper so controllers don't have to know about Flask
    '''
    print "Shared redirect"
    return Redirect(url_path)
