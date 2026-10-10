import pytest
import asyncio
from unittest.mock import patch, MagicMock

# Import the matching logic we'll extract from import_osm
# Since import_osm is a script, we'll test the logic by mocking db and fetch_osm_data

from import_osm import import_district
from app.models.domain import District, State, City, Corridor, Intersection

@pytest.mark.asyncio
@patch('import_osm.fetch_osm_data')
@patch('import_osm.SessionLocal')
async def test_osm_signal_matching(mock_session, mock_fetch):
    # Mock DB Session
    mock_db = MagicMock()
    mock_session.return_value = mock_db
    
    # Mock DB Query Responses
    mock_district = District(id=1, name="Test District", state_id=1)
    mock_state = State(id=1, name="Test State")
    mock_city = City(id=1, name="Test City", district_id=1)
    mock_corridor = Corridor(id=1, name="Test Road", city_id=1)
    
    def mock_query(model):
        m = MagicMock()
        m.filter.return_value.first.side_effect = lambda: {
            District: mock_district,
            State: mock_state,
            City: mock_city,
            Corridor: mock_corridor,
            Intersection: None # No existing intersection
        }.get(model, None)
        return m
        
    mock_db.query.side_effect = mock_query
    
    # Mock OSM Data with 'out geom qt;' format
    mock_osm_response = {
        "elements": [
            {
                "type": "way",
                "id": 100,
                "tags": {"name": "Test Road", "highway": "primary"},
                "geometry": [
                    {"lat": 18.0001, "lon": 72.0001},
                    {"lat": 18.0002, "lon": 72.0002}
                ]
            },
            {
                "type": "node",
                "id": 200,
                "lat": 18.0001, # Exactly on the road
                "lon": 72.0001,
                "tags": {"highway": "traffic_signals"}
            },
            {
                "type": "node",
                "id": 201,
                "lat": 18.00015, # Very close to the road
                "lon": 72.00015,
                "tags": {"highway": "traffic_signals"}
            },
            {
                "type": "node",
                "id": 202,
                "lat": 19.0000, # Far away
                "lon": 73.0000,
                "tags": {"highway": "traffic_signals"}
            }
        ]
    }
    
    mock_fetch.return_value = mock_osm_response
    
    # Run the import
    await import_district(1, explicit_lat=18.0, explicit_lon=72.0, radius=500)
    
    # Check that intersections were added
    # 2 signals are close enough (<30m), 1 is far
    assert mock_db.add.call_count == 2 # 2 intersections added
    # In my mock, mock_corridor is returned, so corridor is NOT added.
    # Therefore, 2 intersections should be added.
    add_calls = mock_db.add.call_args_list
    added_intersections = [call[0][0] for call in add_calls if isinstance(call[0][0], Intersection)]
    
    assert len(added_intersections) == 2
    assert added_intersections[0].source == "osm"
    assert added_intersections[0].is_verified == False
    assert added_intersections[0].match_distance <= 30.0
