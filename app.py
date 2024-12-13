from flask import Flask, request, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///db.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, nullable=False)
    event_number = db.Column(db.Integer, nullable=False)
    time = db.Column(db.String, nullable=False)
    server_time = db.Column(db.String, nullable=False)
    message = db.Column(db.String, nullable=False)
    received_method = db.Column(db.String(50), nullable=False)

    def __repr__(self):
        return f'<Event {self.id} - Session {self.session_id}>'


with app.app_context():
    db.create_all()


@app.route('/log_event', methods=['POST'])
def log_event():
    data = request.json
    server_time = datetime.utcnow().isoformat(timespec='milliseconds') + 'Z'
    event = Event(
        session_id=data.get('session_id'),
        event_number=data.get('event_number'),
        time=data.get('time'),
        server_time=server_time,
        message=data.get('message'),
        received_method='first'
    )
    db.session.add(event)
    db.session.commit()
    return jsonify({"status": "success", "server_time": server_time})

@app.route('/log_events', methods=['POST'])
def log_events():
    data = request.json
    events = data.get('events', [])
    for event_data in events:
        event = Event(
            session_id=event_data.get('session_id'),
            event_number=event_data.get('event_number'),
            time=event_data.get('time'),
            server_time=datetime.utcnow().isoformat(timespec='milliseconds') + 'Z',
            message=event_data.get('message'),
            received_method='second'
        )
        db.session.add(event)
    
    db.session.commit()
    return jsonify({"status": "success", "message": "Events saved successfully"})

@app.route('/get_events/<int:session_id>', methods=['GET'])
def get_events(session_id):
    events = Event.query.filter_by(session_id=session_id, received_method='first').all()
    return jsonify([
        {
            "event_number": event.event_number,
            "time": event.time,
            "server_time": event.server_time,
            "message": event.message
        } for event in events
    ])

@app.route('/get_all_events/<int:session_id>', methods=['GET'])
def get_all_events(session_id):
    events = Event.query.filter_by(session_id=session_id).all()
    event_list = [
        {
            'event_number': event.event_number,
            'time': event.time,
            'server_time': event.server_time,
            'message': event.message,
            'received_method': event.received_method
        }
        for event in events
    ]
    return jsonify({"events": event_list})


@app.route('/')
@app.route('/home')
@app.route('/index')
def index():
    return render_template('index.html')

@app.route('/display')
def display():
    return render_template('display.html')


if __name__ == '__main__':
    app.run(debug=True)
