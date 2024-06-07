import './App.css';
import { useGeolocated } from "react-geolocated";
import React, { useRef, useEffect, useState } from "react";
import { useMountEffect } from 'primereact/hooks';     
import axios from 'axios';

const MBTA_API_KEY = process.env.REACT_APP_MBTA_API_KEY

function Location() {
  const { coords, isGeolocationAvailable, isGeolocationEnabled } =
    useGeolocated({
        positionOptions: {
            enableHighAccuracy: false,
        },
        userDecisionTimeout: 5000,
    });

  return !isGeolocationAvailable ? (
    <div>Your browser does not support Geolocation</div>
  ) : !isGeolocationEnabled ? (
    <div>Geolocation is not enabled</div>
  ) : coords ? (
    <div>
      {coords.latitude}, {coords.longitude}<br/>
      <FetchStops coords={{ latitude: coords.latitude, longitude: coords.longitude}}/>
    </div>
  ) : (
    <div>Getting the location data ...</div>
  );
}

function FetchStops({ coords }) {
  const [nearbyStops, setStops] = useState({ data: [] });
  const [stopData, setStopData] = useState ({});
  const [trackedStops, setTrackedStop] = useState({});
  const [trackedLines, setTrackedLine] = useState({});
  const ref = useRef(null);

  useMountEffect(() => {
    axios.get('https://api-v3.mbta.com/stops?', { params: ({
        api_key: MBTA_API_KEY,
        sort: 'distance',
        latitude: coords.latitude,
        longitude: coords.longitude,
        include : 'parent_station',
        'page[limit]' : 10,
        'fields[stop]' : 'name'
      })})
      .then(response => {
        setStops(response.data)
        console.log(response.data)
      });
    });

  useEffect(() => {
    nearbyStops.data.map(stop => {
      if (!stop.relationships.parent_station.data) {
        axios.get('https://api-v3.mbta.com/routes?', { params: {
          api_key: MBTA_API_KEY,
          'filter[stop]' : stop.id,
          'fields[stop]' : 'direction_names,direction_destinations,short_name,type,color',
        }})
        .then(response => {
          setStopData(stopData => ({
            ...stopData, [stop.id] : response.data.data
          }))
          // console.log(stopData)
          response.data.data.forEach(line => {
            if (!(line.id in trackedLines)) {
              // trackedLines[line.id] = stop.id
              if (!(stop.id in trackedStops)) {
                //trackedStops[stop.id] = stop
                setTrackedStop(stops => ({
                  ...stops, [stop.id] : stop
                }))
              }
            }})
          // console.log(stop.attributes.name);
          // console.log(trackedLines)
          // console.log(trackedStops)
        
        }) 
      } else (console.log(stop.relationships.parent_station.data))
      return(true)
    })
  }, [nearbyStops])

  return (
    <div id="stops" ref={ref}>
      {Object.entries(trackedStops).map(([key, value]) => 
        <div key={key} id={key}>
          <TrackStops stop={value} stopData={stopData[key]}></TrackStops>
        </div>
      )}
    </div>
  )
}

function TrackStops({ stop, stopData }) {
  const controller = new AbortController();
  const signal = controller.signal;
  const [stopState, setStopState] = useState({});
  const [ready, setReady] = useState(false);
  const [routes, setRoutes] = useState({ });

  useMountEffect(() => {
    var arr = {}
    stopData.forEach(item => {
      arr[item.id] = item
    })
    setRoutes(arr)
  })

  useMountEffect(() => {
    const fetchStream = async () => {
      const response = await fetch('https://api-v3.mbta.com/predictions/?' + new URLSearchParams({
        api_key: MBTA_API_KEY,
        sort: 'arrival_time',
        'filter[stop]': stop.id,
        'page[limit]': 5
        }),{
        signal: signal,
        headers: {
          'accept' : 'text/event-stream'
        },
      })
      
      const reader = response.body.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
      
        if (done) {
          console.log("Stream complete");
          break;
        }

        // const message = JSON.parse(('{' + value.toString() + '}'))
        const message = new TextDecoder().decode(value)

        var parsing = message.split('\n\n')
        var parsed = {}

        // this is fragile and horrible
        parsing.forEach((event, index) => {
          if (event === '') {
            return
          }

          try {
            var split = event.split('\n')

            parsed = {
              event: split[0].replace(/^(event: )/, ''),
              data: JSON.parse(split[1].replace(/^(data: )/, ''))
            }
          } catch(e) {
            console.log(e)
            console.log(event)
          }
        })
        
        // console.log(stop.id)
        console.log(parsed)

        switch(parsed.event) {
          case 'reset':
            console.log('reset')
            setStopState({})
            parsed.data.forEach(item => {
              setStopState(stopState => ({
                ...stopState, [item.id] : item
              }))
            })
            setReady(true)
            break;
          case 'add':
            console.log('add')
            console.log(stopState)
            setStopState(stopState => ({
              ...stopState, [parsed.data.id] : parsed.data
            }))
            break;
          case 'update':
            console.log('update')
            setStopState(stopState => ({
              ...stopState, [parsed.data.id] : parsed.data
            }))
            break;
          case 'remove':
            console.log('remove')
            break;
          default:
            break;
        }
      }
    }
    
    fetchStream();

    // return () => {
    //   console.log('abort');
    //   controller.abort();
    // }
  }, [stop])

  var now = new Date();
  var hourFuture = (new Date()).setHours(now.getHours() + 1)

  return (
    <div>
      <hr></hr>
      <h4>
        {stop.attributes.name}
      </h4>
      <h6>
        {stop.id}
      </h6>
      <div className="row text-center justify-content-center">
        {stopData.map(line => 
          <div key={stop.id + '-' + line.id} id={stop.id + '-' + line.id} className="col-3 g-2">
            {line.id}
          </div>
        )}
      </div>
      <hr></hr>
      <table className='table'>
        <tbody>
          {ready ? (
            Object.entries(stopState).map(([key, value]) => {
              var arrival = new Date(value.attributes.arrival_time)
              if ((arrival > now) && (arrival < hourFuture )) {
                return (
                  <tr key={key} id={key}>
                    <td className='p-2'>
                      {value.relationships.route.data.id}
                    </td>
                    <td className='p-2'>
                      {
                        routes[value.relationships.route.data.id].attributes.direction_names[value.attributes.direction_id]
                      } to {
                        routes[value.relationships.route.data.id].attributes.direction_destinations[value.attributes.direction_id]
                      }
                    </td>
                    <td className='p-2'>
                      <TimeUntil date={value.attributes.arrival_time}></TimeUntil>
                    </td>
                  </tr>
                )
              }
              return (false)
            }
          )) : (
            <tr>
              <td>
                ...
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    
  )
}

function TimeUntil({ date }) {
  const [message, setMessage] = useState("")

  useEffect(() => {
    const targetTime = new Date(date)
    const interval = setInterval(function step() {
      var seconds = Math.floor((targetTime - (new Date()))/1000);

      if (seconds < 0) {
        setMessage('ghost bus!');
      } else if (seconds < 30) {
        setMessage('arriving now');
      } else if (seconds < 60) {
        setMessage('approaching');
      } else {
        setMessage('in ' + [Math.floor(seconds / 60)] + ' minute' + [(Math.floor(seconds/60) > 1) ? 's' : '']);
      }

      return step;
    }(), 15000);
    return () => {
      clearInterval(interval);
    };
  }, [date]);

  return (
    <span>
      {message}
    </span>
  )
}

function App() {
  return (
    <div className="App container">
      <header className='pb-4'>
        <h6>
          let's hope it works better this time
        </h6>
      </header>
      <main>
        <Location />
      </main>
      <footer>

      </footer>
    </div>
  );
}

export default App;
