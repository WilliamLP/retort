import datetime
import flask
import importlib
import os
import time

import config
import shared

app = flask.Flask(__name__)

menu = [
    {'tab': 'Cities', 'path': '/cities/index'},
]

def setup():
    '''
    Various initializations
    '''
    app.debug = True
    app.secret_key = config.config['FLASK_SECRET']

    os.environ['TZ'] = 'US/Eastern'
    time.tzset()

setup()

@app.route('/')
def dispatch_root():
    return flask.redirect(menu[0]['path'])

@app.route('/<controller>/')
def dispatch_controller(controller):
    if controller == 'favicon.ico':
        flask.abort(404)  # prevent log spam
    return flask.redirect('/%s/index' % controller)

@app.route('/<controller>/<action>/', methods=['GET', 'POST'])
def dispatch_controller_action(controller, action):
    return dispatch(controller, action, None)

@app.route('/<controller>/<action>/<path:path>', methods=['GET', 'POST'])
def dispatch(controller, action, path):
    if controller == 'static':
        # This catch-all otherwise clobbers Flask's static behaviour.
        return app.send_static_file(flask.request.path[8:])

    try:
        controller_module = importlib.import_module('controllers.%s' % controller)
    except ImportError, e:
        flask.abort(404)

    try:
        action_function = getattr(controller_module, action)
    except AttributeError:
        flask.abort(404)

    # The parameters to pass to the dispatch are any from the URL, the path, and a post if applicable.
    params = flask.request.args.copy()
    params['path'] = path.split('/') if path else []
    if flask.request.method == 'POST':
        params['post'] = flask.request.form

    result = action_function(params)

    if isinstance(result, shared.Redirect):
        return flask.redirect(result.url_path)

    # If there's a template, use it.
    template_name = '%s/%s.html' % (controller, action)
    try_path = os.path.dirname(os.path.realpath(__file__)) + '/templates/' + template_name
    print "trying template: " + try_path
    if os.path.exists(try_path):
        print "template found"
        # Allow no return to work, for a template with no parameters.
        if result is None:
            result = dict()
        # Add parameters for layout
        result['tabs'] = tab_info()

        return flask.render_template(template_name, **result)
    else:
        # The Flask encoder doesn't handle dates, so injecting one that does saves some boilerplate.
        return flask.Response(flask.json.dumps(result, cls=LocalJSONEncoder),
            mimetype='application/json')

def tab_info():
    '''
    Info about all tabs including which is selected, for the layout and navbar.
    '''
    result = []
    for menu_tab in menu:
        tab = menu_tab.copy()
        tab['selected'] = flask.request.path.startswith(tab['path'])
        result.append(tab)

    return result

class LocalJSONEncoder(flask.json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime.date):
            return obj.isoformat()

if __name__ == '__main__':
    app.run()