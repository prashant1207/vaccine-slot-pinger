#!/usr/bin/env node
const axios = require('axios');
const prompt = require('prompt-sync')({ sigint: true });
const argv = require('minimist')(process.argv.slice(2));
const { format } = require('date-fns');
const sound = require("sound-play");
const path = require("path");
const notificationSound = path.join(__dirname, "sounds/beep.wav");

const defaultInterval = 5; // interval between pings in minutes
const appointmentsListLimit = 2;
let timer = null;
const sampleUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36'

initiateScript();

function initiateScript() {
    const districtId = Number(prompt("Enter district Id: "));
    const age = Number(prompt("Enter Age: "));
    const pingInternal = Number(prompt("Enter Ping Interval(default is 5 mins): "));
    if (!districtId && !age) {
        initiateScript();
    }

    const params = {
        age: age,
        districtId: districtId,
        interval: pingInternal || defaultInterval,
        appointmentsListLimit: argv.appts || appointmentsListLimit,
        date: argv.date || format(new Date(), 'dd-MM-yyyy'),
        pin: argv.pin
    }

    scheduleCowinPinger(params);
}

function scheduleCowinPinger(params) {
    let pingCount = 0;
    timer = setInterval(() => {
        console.clear();
        pingCount += 1;
        pingCowin(params);
        console.log("Ping Count - ", pingCount);
    }, params.interval * 60000);
}

function pingCowin({ age, districtId, appointmentsListLimit, date, pin }) {
    let url = `https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByDistrict?district_id=${districtId}&date=${date}`
    if (pin) {
        url = `https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByPin?pincode=${pin}&date=${date}`
    }
    axios.get(url, { headers: { 'User-Agent': sampleUserAgent } }).then((result) => {
        const { centers } = result.data;
        let isSlotAvailable = false;
        let dataOfSlot = "";
        let appointmentsAvailableCount = 0;
        if (centers.length) {
            centers.forEach(center => {
                center.sessions.forEach((session => {
                    if (session.min_age_limit < +age && session.available_capacity > 0) {
                        isSlotAvailable = true
                        appointmentsAvailableCount++;
                        if (appointmentsAvailableCount <= appointmentsListLimit) {
                            dataOfSlot = `${dataOfSlot}\nSlot for ${session.available_capacity} is available: ${center.name} on ${session.date}`;
                        }
                    }
                }))
            });

            if (appointmentsAvailableCount - appointmentsListLimit) {
                dataOfSlot = `${dataOfSlot}\n${appointmentsAvailableCount - appointmentsListLimit} more slots available...`
            }
        }
        if (isSlotAvailable) {
            console.log(dataOfSlot);
            console.log('Slots found\nStopping Pinger...')
            sound.play(notificationSound, 1);
            clearInterval(timer);
        }
    }).catch((err) => {
        console.log("Error: " + err.message);
    });
}