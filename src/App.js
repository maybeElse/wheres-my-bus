import logo from './logo.svg';
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
      {coords.latitude}, {coords.longitude}
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
        include : 'route',
        'page[limit]' : 5
      })})
      .then(response => {
        setStops(response.data)
        console.log("nearbyStops")
        console.log(nearbyStops.data)
      })
      .then(response => {
        
      })
    });

  useEffect(() => {
    nearbyStops.data.map(stop => {
      axios.get('https://api-v3.mbta.com/routes?', { params: {
        api_key: MBTA_API_KEY,
        'filter[stop]' : stop.id
      }})
      .then(response => {
        setStopData(stopData => ({
          ...stopData, [stop.id] : response.data.data
        }))
        console.log(stopData)
        response.data.data.forEach(line => {
          if (!(line.id in trackedLines)) {
            trackedLines[line.id] = stop.id
            if (!(stop.id in trackedStops)) {
              //trackedStops[stop.id] = stop
              setTrackedStop(stops => ({
                ...stops, [stop.id] : stop
              }))
            }
          }})
        console.log(stop.attributes.name);
        console.log(trackedLines)
        console.log(trackedStops)
      })
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
  const [stopState, setStopState] = useState({});
  console.log(stop.attributes.name)
  console.log(stopData)

  // useEffect(() => {
  //   axios.get('https://api-v3.mbta.com/predictions/?', {
  //     responseType: 'stream',
  //     params: {
  //       api_key: MBTA_API_KEY,
  //       sort: 'arrival_time',
  //       'filter[stop]': stop.id,
  //       'page[limit]': 5
  //     }
  //   }).then(response => {
  //     //console.log(response.data)
  //   })
  // })

  return (
    <div>
      <h4>
        {stop.attributes.name}
      </h4>
      <div class="row">
        {stopData.map(line => 
          <span id="{stop.id}-{line.id}" class="g-2">
            {line.id}
          </span>
        )}
      </div>
    </div>
    
  )
}

function App() {
  return (
    <div className="App" class="container">
      <header>
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
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
