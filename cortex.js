//const WebSocket = require('ws');

	/**
	 * This class handle:
	 *  - create websocket connection
	 *  - handle request for : headset , request access, control headset ...
	 *  - handle 2 main flows : sub and train flow
	 *  - use async/await and Promise for request need to be run on sync
	 */
	class Cortex {
		constructor (user, socketUrl) {
			// create socket
			//process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0
			this.socket = new WebSocket(socketUrl)

			// read user infor
			this.user = user
			
			this.currentAction = ['neutral', 0, 0]
			
			// Identify commands for Events
			this.mindupCommand = new Event('mindup')
			this.minddownCommand = new Event('minddown')
			
		}


		/**
		 * 
		 * - load profile which trained before
		 * - sub 'com' stream (mental command)
		 * - user think specific thing which used while training, for example 'push' action
		 * - 'push' command should show up on mental command stream
		 */
		live(command='', sensitivity=0, profileName='') {
			let commandEvent = this.mindupCommand
			let commandBreakEvent = this.minddownCommand
			let currentAction = this.currentAction
			this.socket.onopen = async()=>{
				await this.checkGrantAccessAndQuerySessionInfo()
				// load profile
				if (profileName != ''){
					let loadProfileResult=""
					let status = "load"
					await this.setupProfile(this.authToken, 
											this.headsetId, 
											profileName, 
											status).then((result)=>{loadProfileResult=result})
					console.log("Live PRofile: " + loadProfileResult)
				}
				// // sub 'com' stream and view live mode
				this.subRequest(['com'], this.authToken, this.sessionId)
				this.socket.onmessage = function(data){
					var message = data['data']
					//console.log(message)
					//console.log(JSON.parse(message)['com'][0] + " _ " + JSON.parse(message)['com'][0] + " _ " + JSON.parse(message)['time'])
					currentAction[0] = JSON.parse(message)['com'][0]
					currentAction[1] = JSON.parse(message)['com'][1]
					currentAction[2] = JSON.parse(message)['time']
					//console.log(currentAction)
					if(currentAction[0]==command && currentAction[1]>sensitivity){
							// console.log('MENTAL COMMAND ACTIVE ACTION RESULT --------------------')
							// console.log(message)
							// console.log('\r\n')
							// console.log(commandEvent)
							window.dispatchEvent(commandEvent)
							//resolve(data)
					}
					else{
						//console.log(commandBreakEvent)
						window.dispatchEvent(commandBreakEvent)
					}

				}
			}
		}

		queryHeadsetId(){
			const QUERY_HEADSET_ID = 2
			let socket = this.socket
			let queryHeadsetRequest =  {
				"jsonrpc": "2.0", 
				"id": QUERY_HEADSET_ID,
				"method": "queryHeadsets",
				"params": {}
			}

			return new Promise(function(resolve, reject){
				socket.send(JSON.stringify(queryHeadsetRequest));
				socket.onmessage = function(data){
					var message = data['data']
					console.log(message)
					try {
						if(JSON.parse(message)['id']==QUERY_HEADSET_ID){
							// console.log(data)
							// console.log(JSON.parse(data)['result'].length)
							if(JSON.parse(message)['result'].length > 0){
								let headsetId = JSON.parse(message)['result'][0]['id']
								resolve(headsetId)
							}
							else{
								console.log('No have any headset, please connect headset with your pc.')
							}
						}
					   
					} catch (error) {}
				}
			})
		}

		requestAccess(){
			let socket = this.socket
			let user = this.user
			return new Promise(function(resolve, reject){
				const REQUEST_ACCESS_ID = 1
				let requestAccessRequest = {
					"jsonrpc": "2.0", 
					"method": "requestAccess", 
					"params": { 
						"clientId": user.clientId, 
						"clientSecret": user.clientSecret
					},
					"id": REQUEST_ACCESS_ID
				}

				console.log('start send request: ',requestAccessRequest)
				socket.send(JSON.stringify(requestAccessRequest));

				socket.onmessage = function(data){
					var message = data['data']
					try {
						if(JSON.parse(message)['id']==REQUEST_ACCESS_ID){
							resolve(message)
						}
					} catch (error) {
						console.log('Error on message: '+error);
					}
				}
			})
		}

		authorize(){
			let socket = this.socket
			let user = this.user
			return new Promise(function(resolve, reject){
				const AUTHORIZE_ID = 4
				let authorizeRequest = { 
					"jsonrpc": "2.0", "method": "authorize", 
					"params": { 
						"clientId": user.clientId, 
						"clientSecret": user.clientSecret, 
						"license": user.license, 
						"debit": user.debit
					},
					"id": AUTHORIZE_ID
				}
				//console.log(JSON.stringify(authorizeRequest))
				socket.send(JSON.stringify(authorizeRequest))
				socket.onmessage = function(data){
					var message = data['data']
					try {
						//console.log("Auth Request result:" + data)
						if(JSON.parse(message)['id']==AUTHORIZE_ID){
							let cortexToken = JSON.parse(message)['result']['cortexToken']
							resolve(cortexToken)
						}
					} catch (error) {console.log(error)}
				}
			})
		}

		controlDevice(headsetId){
			let socket = this.socket
			const CONTROL_DEVICE_ID = 3
			let controlDeviceRequest = {
				"jsonrpc": "2.0",
				"id": CONTROL_DEVICE_ID,
				"method": "controlDevice",
				"params": {
					"command": "connect",
					"headset": headsetId
				}
			}
			return new Promise(function(resolve, reject){
				socket.send(JSON.stringify(controlDeviceRequest));
				socket.onmessage = function(data){
					var message = data['data']
					try {
						if(JSON.parse(message)['id']==CONTROL_DEVICE_ID){
							resolve(message)
						}
					} catch (error) {}
				}
			}) 
		}

		createSession(authToken, headsetId){
			let socket = this.socket
			const CREATE_SESSION_ID = 5
			let createSessionRequest = { 
				"jsonrpc": "2.0",
				"id": CREATE_SESSION_ID,
				"method": "createSession",
				"params": {
					"cortexToken": authToken,
					"headset": headsetId,
					"status": "active"
				}
			}
			return new Promise(function(resolve, reject){
				console.log(JSON.stringify(createSessionRequest));
				socket.send(JSON.stringify(createSessionRequest));
				socket.onmessage = function(data){
					var message = data['data']
					console.log(message)
					try {
						if(JSON.parse(message)['id']==CREATE_SESSION_ID){
							let sessionId = JSON.parse(message)['result']['id']
							resolve(sessionId)
						}
					} catch (error) {
						console.log(error)
					}
				}
			})
		}

		startRecord(authToken, sessionId, recordName){
			let socket = this.socket
			const CREATE_RECORD_REQUEST_ID = 11

			let createRecordRequest = {
				"jsonrpc": "2.0", 
				"method": "updateSession", 
				"params": {
					"cortexToken": authToken,
					"session": sessionId,
					"status": "startRecord",
					"title": recordName,
					"description":"test_marker",
					"groupName": "QA"
				}, 
				"id": CREATE_RECORD_REQUEST_ID
			}

			return new Promise(function(resolve, reject){
				socket.send(JSON.stringify(createRecordRequest));
				socket.on('message', (data)=>{
					try {
						if(JSON.parse(data)['id']==CREATE_RECORD_REQUEST_ID){
							console.log('CREATE RECORD RESULT --------------------------------')
							console.log(data)
							resolve(data)
						}
					} catch (error) {}
				})
			})
		}



		injectMarkerRequest(authToken, sessionId, label, value, port, time){
			let socket = this.socket
			const INJECT_MARKER_REQUEST_ID = 13
			let injectMarkerRequest = {
				"jsonrpc": "2.0",
				"id": INJECT_MARKER_REQUEST_ID,
				"method": "injectMarker", 
				"params": {
					"cortexToken": authToken, 
					"session": sessionId, 
					"label": label,
					"value": value, 
					"port": port,
					"time": time
				}
			}

			return new Promise(function(resolve, reject){
				socket.send(JSON.stringify(injectMarkerRequest));
				socket.on('message', (data)=>{
					try {
						if(JSON.parse(data)['id']==INJECT_MARKER_REQUEST_ID){
							console.log('INJECT MARKER RESULT --------------------------------')
							console.log(data)
							resolve(data)
						}
					} catch (error) {}
				})
			})
		}



		stopRecord(authToken, sessionId, recordName){
			let socket = this.socket
			const STOP_RECORD_REQUEST_ID = 12
			let stopRecordRequest = {
				"jsonrpc": "2.0", 
				"method": "updateSession", 
				"params": {
					"cortexToken": authToken,
					"session": sessionId,
					"status": "stopRecord",
					"title": recordName,
					"description":"test_marker",
					"groupName": "QA"
				}, 
				"id": STOP_RECORD_REQUEST_ID
			}

			return new Promise(function(resolve, reject){
				socket.send(JSON.stringify(stopRecordRequest));
				socket.on('message', (data)=>{
					try {
						if(JSON.parse(data)['id']==STOP_RECORD_REQUEST_ID){
							console.log('STOP RECORD RESULT --------------------------------')
							console.log(data)
							resolve(data)
						}
					} catch (error) {}
				})
			})
		}

		addMarker(){
			this.socket.on('open',async ()=>{
				await this.checkGrantAccessAndQuerySessionInfo()

				let recordName = 'test_marker'
				await this.startRecord(this.authToken, this.sessionId, recordName)

			
				let thisInjectMarker = this
				let numberOfMarker = 10
				for (let numMarker=0; numMarker<numberOfMarker; numMarker++){
					setTimeout(async function(){
						// injectMarkerRequest(authToken, sessionId, label, value, port, time)
						let markerLabel = "marker_number_" + numTrain
						let markerTime = Date.now()
						let marker = {
							label:markerLabel,
							value:"test",
							port:"test",
							time:markerTime
						}

						await thisInjectMarker.injectMarkerRequest( thisInjectMarker.authToken, 
																	thisInjectMarker.sessionId,
																	marker.label,
																	marker.value,
																	marker.port,
																	marker.time)
					}, 3000)
				}

				await thisStopRecord.stopRecord(thisStopRecord.authToken, thisStopRecord.sessionId, recordName)
			})
		}

		subRequest(stream, authToken, sessionId, command){
			let socket = this.socket
			const SUB_REQUEST_ID = 6 
			let subRequest = { 
				"jsonrpc": "2.0", 
				"method": "subscribe", 
				"params": { 
					"cortexToken": authToken,
					"session": sessionId,
					"streams": stream
				}, 
				"id": SUB_REQUEST_ID
			}
			//console.log('sub eeg request: ', JSON.stringify(subRequest))
			socket.send(JSON.stringify(subRequest))
			socket.onmessage = function(data){
				try {				
					// if(JSON.parse(data)['id']==SUB_REQUEST_ID){
						//console.log('SUB REQUEST RESULT --------------------------------')
						//console.log(data)
						//console.log('\r\n')
					// }
				} catch (error) {console.log(error)}
			}
		}

		mentalCommandActiveActionRequest(authToken, sessionId, profile, action){
			let socket = this.socket
			const MENTAL_COMMAND_ACTIVE_ACTION_ID = 10
			let mentalCommandActiveActionRequest = {
				"jsonrpc": "2.0",
				"method": "mentalCommandActiveAction",
				"params": {
				  "cortexToken": authToken,
				  "status": "set",
				  "session": sessionId,
				  "profile": profile,
				  "actions": action
				},
				"id": MENTAL_COMMAND_ACTIVE_ACTION_ID
			}
			// console.log(mentalCommandActiveActionRequest)
			return new Promise(function(resolve, reject){
				socket.send(JSON.stringify(mentalCommandActiveActionRequest))
				socket.on('message', (data)=>{
					try {
						if(JSON.parse(data)['id']==MENTAL_COMMAND_ACTIVE_ACTION_ID){
							console.log('MENTAL COMMAND ACTIVE ACTION RESULT --------------------')
							console.log(data)
							console.log('\r\n')
							resolve(data)
						}
					} catch (error) {
						console.log(error)
					}
				})
			})
		}

		/**
		 * - query headset infor
		 * - connect to headset with control device request
		 * - authentication and get back auth token
		 * - create session and get back session id
		 */
		async querySessionInfo(){
			let headsetId=""
			await this.queryHeadsetId().then((headset)=>{headsetId = headset})
			this.headsetId = headsetId

			let ctResult=""
			await this.controlDevice(headsetId).then((result)=>{ctResult=result})
			this.ctResult = ctResult
			console.log(ctResult)

			let authToken=""
			await this.authorize().then((auth)=>{authToken = auth})
			this.authToken = authToken
			console.log("Token:"+authToken)

			let sessionId = ""
			await this.createSession(authToken, headsetId).then((result)=>{sessionId=result})
			this.sessionId = sessionId

			console.log('HEADSET ID -----------------------------------')
			console.log(this.headsetId)
			console.log('\r\n')
			console.log('CONNECT STATUS -------------------------------')
			console.log(this.ctResult)
			console.log('\r\n')
			console.log('AUTH TOKEN -----------------------------------')
			console.log(this.authToken)
			console.log('\r\n')
			console.log('SESSION ID -----------------------------------')
			console.log(this.sessionId)
			console.log('\r\n')
		}

		/**
		 * - check if user logined
		 * - check if app is granted for access
		 * - query session info to prepare for sub and train
		 */
		async checkGrantAccessAndQuerySessionInfo(){
			let requestAccessResult = ""
			console.log("in checkGrantAccessAndQuerySessionInfo")
			await this.requestAccess().then((result)=>{requestAccessResult=result})

			let accessGranted = JSON.parse(requestAccessResult)
		
			// check if user is logged in CortexUI
			if ("error" in accessGranted){
				console.log('You must login on CortexUI before request for grant access then rerun')
				throw new Error('You must login on CortexUI before request for grant access')
			}else{
				console.log(accessGranted['result']['message'])
				console.log(accessGranted['result']['accessGranted'])
				if(accessGranted['result']['accessGranted']){
					await this.querySessionInfo()
				}
				else{
					console.log('You must accept access request from this app on CortexUI then rerun')
					throw new Error('You must accept access request from this app on CortexUI')
				}
			}   
		}


		/**
		 * 
		 * - check login and grant access
		 * - subcribe for stream
		 * - logout data stream to console or file
		 */
		sub(streams, command){
			let commandEvent = this.mindupCommand
			this.socket.onopen = async()=>{
				console.log("Check Grant...")
				await this.checkGrantAccessAndQuerySessionInfo()
				console.log("Streaming...")
				this.subRequest(streams, this.authToken, this.sessionId, command)
				this.socket.onmessage = function(data){
					var message = data['data']
					//console.log(message)
					console.log(JSON.parse(message)['com'][0])
					if(JSON.parse(message)['com'][0]==command){
							console.log('MENTAL COMMAND ACTIVE ACTION RESULT --------------------')
							console.log(message)
							console.log('\r\n')
							console.log(commandEvent)
							window.dispatchEvent(commandEvent)
							//resolve(data)
					}	
				}
			}
		}


		setupProfile(authToken, headsetId, profileName, status){
			const SETUP_PROFILE_ID = 7
			let setupProfileRequest = {
				"jsonrpc": "2.0",
				"method": "setupProfile",
				"params": {
				  "cortexToken": authToken,
				  "headset": headsetId,
				  "profile": profileName,
				  "status": status
				},
				"id": SETUP_PROFILE_ID
			}
			// console.log(setupProfileRequest)
			let socket = this.socket
			return new Promise(function(resolve, reject){
				socket.send(JSON.stringify(setupProfileRequest));
				socket.on('message', (data)=>{
					if(status=='create'){
						resolve(data)
					}

					try {
						// console.log('inside setup profile', data)
						if(JSON.parse(data)['id']==SETUP_PROFILE_ID){
							if(JSON.parse(data)['result']['action']==status){
								console.log('SETUP PROFILE -------------------------------------')
								console.log(data)
								console.log('\r\n')
								resolve(data)
							}
						}
						
					} catch (error) {
						
					}

				})
			})
		}

		queryProfileRequest(authToken){
			const QUERY_PROFILE_ID = 9
			let queryProfileRequest = {
				"jsonrpc": "2.0",
				"method": "queryProfile",
				"params": {
				  "cortexToken": authToken
				},
				"id": QUERY_PROFILE_ID
			}

			let socket = this.socket
			return new Promise(function(resolve, reject){
				socket.send(JSON.stringify(queryProfileRequest))
				socket.on('message', (data)=>{
					try {
						if(JSON.parse(data)['id']==QUERY_PROFILE_ID){
							// console.log(data)
							resolve(data)
						}
					} catch (error) {
						
					}
				})
			})
		}


		/**
		 *  - handle send training request
		 *  - handle resolve for two difference status : start and accept
		 */
		trainRequest(authToken, sessionId, action, status){
			const TRAINING_ID = 8
			const SUB_REQUEST_ID = 6
			let trainingRequest = {
				"jsonrpc": "2.0", 
				"method": "training", 
				"params": {
				  "cortexToken": authToken,
				  "detection": "mentalCommand",
				  "session": sessionId,
				  "action": action,
				  "status": status
				}, 
				"id": TRAINING_ID
			}

			// console.log(trainingRequest)
			// each train take 8 seconds for complete
			console.log('YOU HAVE 8 SECONDS FOR THIS TRAIN')
			console.log('\r\n')
			
			let socket = this.socket
			return new Promise(function(resolve, reject){
				socket.send(JSON.stringify(trainingRequest))
				socket.on('message', (data)=>{
					// console.log('inside training ', data)
					try {
						if (JSON.parse(data)[id]==TRAINING_ID){
							console.log(data)
						}  
					} catch (error) {}

					// incase status is start training, only resolve until see "MC_Succeeded"
					if (status == 'start'){
						try {
							if(JSON.parse(data)['sys'][1]=='MC_Succeeded'){
								console.log('START TRAINING RESULT --------------------------------------')
								console.log(data)
								console.log('\r\n')
								resolve(data)
							}
						} catch (error) {}
					}

					// incase status is accept training, only resolve until see "MC_Completed"
					if (status == 'accept'){
						try {
							if(JSON.parse(data)['sys'][1]=='MC_Completed'){
								console.log('ACCEPT TRAINING RESULT --------------------------------------')
								console.log(data)
								console.log('\r\n')
								resolve(data)
							}
						} catch (error) {}
					}
				})
			})
		}

		/**
		 * - check login and grant access
		 * - create profile if not yet exist
		 * - load profile
		 * - sub stream 'sys' for training
		 * - train for actions, each action in number of time
		 * 
		 */
		train(profileName, trainingActions, numberOfTrain){
			this.socket.on('open',async ()=>{

				console.log("start training flow")
				
				// check login and grant access
				await this.checkGrantAccessAndQuerySessionInfo()

				// to training need subcribe 'sys' stream
				this.subRequest(['sys'], this.authToken, this.sessionId)

				// create profile 
				let status = "create";
				let createProfileResult = ""
				await this.setupProfile(this.authToken, 
										this.headsetId, 
										profileName, status).then((result)=>{createProfileResult=result})

				// load profile
				status = "load"
				let loadProfileResult = ""
				await this.setupProfile(this.authToken,
										this.headsetId, 
										profileName, status).then((result)=>{loadProfileResult=result})
				
				// training all actions
				let self = this

				for (let trainingAction of trainingActions){
					for (let numTrain=0; numTrain<numberOfTrain; numTrain++){
						// start training for 'neutral' action
						console.log(`START TRAINING "${trainingAction}" TIME ${numTrain+1} ---------------`)
						console.log('\r\n')
						await self.trainRequest(self.authToken, 
											self.sessionId, 
											trainingAction, 
											'start')

						//
						// FROM HERE USER HAVE 8 SECONDS TO TRAIN SPECIFIC ACTION
						//
						

						// accept 'neutral' result
						console.log(`ACCEPT "${trainingAction}" TIME ${numTrain+1} --------------------`)
						console.log('\r\n')
						await self.trainRequest(self.authToken, 
											self.sessionId, 
											trainingAction, 
											'accept')
					}
					
					let status = "save"
					let saveProfileResult = ""

					// save profile after train
					await self.setupProfile(self.authToken,
											self.headsetId, 
											profileName, status)
											.then((result)=>{
												saveProfileResult=result
												console.log(`COMPLETED SAVE ${trainingAction} FOR ${profileName}`)
											})                               
				}
			})
		}


	}