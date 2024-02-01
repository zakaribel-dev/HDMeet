/* eslint-disable no-lone-blocks */
/* eslint-disable no-loop-func */
import React, { Component } from "react"
import io from "socket.io-client"
import { Input, Button } from "@material-ui/core"
import logo from "../assets/hdmlogo.png"
import backgroundBlck from "../assets/blckdef.png"
import userDisconnectedSound from "../assets/disconnected.mp3"
import Rodal from "rodal"
import "rodal/lib/rodal.css"
import { message, Flex, Spin } from "antd" // superbe bibliotheque
import axios from "axios"
import { Row } from "reactstrap"
import "bootstrap/dist/css/bootstrap.css"
import "../style/Video.css"
import Sidebar from "./partials/sideBar"
import ControlBar from "./partials/controlBar"
import { Link } from "react-router-dom"

// attention à faire en sorte qu'il y ait pas de souci avec protocol SSL (ça m'a bien fait chier)
const server_url =
  process.env.NODE_ENV === "production" 
    ? "https://zakaribel.com:4001"
    : "http://localhost:4001"

// Pourquoi je déclare ces sortes de states global ?
//Parce qu'à chaque fois qu'un utilisateur join une room, IL VA CREER UNE INSTANCE DE MAIN (ce composant)
// du coup, on veut qu'à chaque instances video
// l'utilisateur recoive le nouveau "VideoElements", "connections" etc etc qui eux sont mis à jour globalement!
let connections = {}
let socket = null
let socketId = null
let videoElements = 0

const peerConnectionConfig = {
  iceServers: [
    // Serveurs STUN(co avec la plus part des NAT)
    { urls: "stun:stun.services.mozilla.com" },
    { urls: "stun:stun.l.google.com:19302" },

    // Serveur TURN (si un user est derrière un nat restrictif ou un pare feu chiant, un serveur TURN prendra le relais)
    {
      urls: "turn:turn.anyfirewall.com:443?transport=tcp",
      credential: "webrtc",
      username: "webrtc",
    },
  ],
}

class Main extends Component {
  constructor(props) {
    super(props)
    this.myVideo = React.createRef()
    this.iceCandidatesQueue = {}
    this.videoAvailable = false
    this.audioAvailable = false

    this.state = {
      video: false,
      audio: false,
      screen: false,
      showModal: false,
      screenAvailable: false,
      socketId: '',
      messages: [],
      message: "",
      newmessages: 0,
      askForUsername: true,
      username: "",
      usernames: {},
      isSidebarOpen: false,
      requestingSpeech: false,
      speechRequestMessage: "",
      password: "",
      authorizedUsers: [],
      connectedEmails: [],
      currentUserEmail: "",
      isAdmin: false,
      loadingCamera: true,      
    }
    
    axios
    .get(`${server_url}/users`, { withCredentials: true } )
      .then((response) => {
        this.setState({ authorizedUsers: response.data })
      })
      .catch((error) => {
        console.error(
          "Erreur lors de la récupération des utilisateurs :",
          error
        )
      })

    this.sourcesPermissions()
  }

  componentDidMount() {
    window.addEventListener("beforeunload", this.handleBeforeUnload);
  }
  
  handleBeforeUnload = () => { // si un user refresh la page on trigger une emission socket pour déco l'user (car de base ça a un comportement chiant (duplication user dans la room etc..
    // Donc je prefere etre radical et déco directement l'utilisateur qui devra revenir dans la room manuellement))
    if (socket) {
    socket.emit("refreshingPage");
    }
  };

  toggleSidebar = () => {
    this.setState((prevState) => ({
      isSidebarOpen: !prevState.isSidebarOpen,
    }))
  }

  sourcesPermissions = async () => {
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      })
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })

      // en faisant "!!navigator.mediaDevices.getDisplayMedia" je vérifie si la methode getDisplayMedia est dispo dans le navigateur
      // si c'est le cas ça veut dire que le navigateur supporte le partage d'écran
      // donc ça me retrourne true et donc je met à jour ma state
      // (state qui va déterminer si j'affiche le bouton de partage ou non)
      const screenAvailable = !!navigator.mediaDevices.getDisplayMedia
      this.setState({ screenAvailable })

      if (videoStream || audioStream) {
        // si on a l'aautorisation pour l'audio ou la video de l'user
        window.localStream = videoStream || audioStream // je recupere le flux autorisé par l'user dans window.localStream
        this.myVideo.current.srcObject = window.localStream // j'affiche ce flux dans mon element video
        this.setState({ loadingCamera: false })
      }

      this.videoAvailable = !!videoStream // videoAvailable à true si videoStream est true et vis versa
      this.audioAvailable = !!audioStream // meme délire
      this.screenAvailable = screenAvailable
    } catch (error) {
      console.error(error)
      this.setState({ loadingCamera: false })
    }
  }

  getMediasAndInitConnection = () => {
    this.setState(
      {
        video: this.videoAvailable, // videoAvailable = acces video autorisé par user donc this.state.video sera true
        audio: this.audioAvailable, // ...
      },
      () => {
        this.getSources()  // llorsque l'utilisateur arrivera dans la room sa camera/son audio sera activée ou désactivée en fonction des permissions 
        this.serverConnection() // ensuite jenclenche la logique de connexion server notamment en recuperant l'username, l'email, signal pour SDP/iceCandidates etc....
      }
    )
  }
  
  getSources = () => {
    if ((this.state.video && this.videoAvailable) || (this.state.audio && this.audioAvailable)) {
      navigator.mediaDevices.getUserMedia({ video: this.state.video, audio: this.state.audio })
        .then((stream) => {
          // Call getSources_Success directly or perform any other logic with the stream
          this.getSources_Success(stream);
        })
        .catch((e) => console.log(e));
    } else {
      // If neither audio nor video are enabled, stop the current media stream
      try {
        if (this.myVideo.current && this.myVideo.current.srcObject) {
          let tracks = this.myVideo.current.srcObject.getTracks();
          tracks.forEach((track) => track.stop());
        }
      } catch (e) {
        console.log(e);
      }
    }
  };
  

  getSources_Success = (stream) => {
    // "stream" contient mon objet MediaStream qui m'est retourné quand l'user a accepté qu'on ait acces à sa cam + micro..
    //(voir plus haut dans getSources)
    // Met à jour le flux local avec le nouveau flux de la caméra/microphone.
    window.localStream = stream
    this.myVideo.current.srcObject = stream
    
    // ici je boucle dans toute les connexions actuelles..
    for (let id in connections) {
      if (id === socketId) continue // la jdis que si dans la liste des sockets ya une id qui correspond à MA socketId(moi)
      //alors je saute l'itération, jlui dis de pas calculer et de continuer son petit bonhomme de chemin

      //je stream la petite bouille du streamer à tous les users dans la room en ajoutant le flux actuel à toute les connexions webRTC
      connections[id].addStream(window.localStream)

      // ici je DOIS créer une offre qui contient un "SDP" (go check https://developer.mozilla.org/fr/docs/Glossary/SDP)
      // et ce sera envoyé aux autres users
      connections[id]
        .createOffer()
        .then((description) => connections[id].setLocalDescription(description))
        .then(() => {
          // du coup j'envoie tout ça via une websocket..
          // mon emission "signal" contiendra mon offer pour que tous les autres users puisse la receptionner
          // createOffer qui va creer une SDP est un processus OBLIGATOIRE pour établir une connexion WebRTC
          // c'est comme si t'allais à la banque pour ouvrir un compte et tu signes aucun papiers..
          socket.emit(
            "signal",
            id,
            JSON.stringify({ sdp: connections[id].localDescription })
          )
        })
        .catch((e) => console.log(e))
    }
  }

  

  // ici je vais réceptionner tout ce qui est SDP/iceCandidates
  signalFromServer = (fromId, body) => {
    let signal = JSON.parse(body);
  
    if (fromId !== socketId) {
      if (signal.sdp) {
        connections[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(() => {
            console.log(`Remote description set successfully for ${fromId}`);
            
            if (signal.sdp.type === "offer") {
              connections[fromId]
                .createAnswer()
                .then((description) => {
                  console.log(`Answer created successfully for ${fromId}`);
                  
                  connections[fromId]
                    .setLocalDescription(description)
                    .then(() => {
                      console.log(`Local description set successfully for ${fromId}`);
                      
                      socket.emit(
                        "signal",
                        fromId,
                        JSON.stringify({
                          sdp: connections[fromId].localDescription,
                        })
                      );
                    })
                    .catch((e) => console.error(`Error setting local description for ${fromId}:`, e));
                })
                .catch((e) => console.error(`Error creating answer for ${fromId}:`, e));
            }
  
            if (this.iceCandidatesQueue[fromId]) {
              this.iceCandidatesQueue[fromId].forEach((candidate) => {
                connections[fromId]
                  .addIceCandidate(new RTCIceCandidate(candidate))
                  .catch((e) => console.error(`Error adding ice candidate for ${fromId}:`, e));
              });
              delete this.iceCandidatesQueue[fromId];
            }
          })
          .catch((e) => console.error(`Error setting remote description for ${fromId}:`, e));
      }
  
      if (signal.ice) {
        let iceCandidate = new RTCIceCandidate(signal.ice);
        if (connections[fromId].remoteDescription) {
          connections[fromId]
            .addIceCandidate(iceCandidate)
            .catch((e) => console.error(`Error adding ice candidate for ${fromId}:`, e));
        } else {
          if (!this.iceCandidatesQueue[fromId]) {
            this.iceCandidatesQueue[fromId] = [];
          }
          this.iceCandidatesQueue[fromId].push(iceCandidate);
        }
      }
    }
  };
  

  serverConnection = () => {
    socket = io.connect(server_url, { secure: true })

    // demande de parole
    socket.on("speech-requested", ({ username }) => {
      message.warning({
        content: `${username} souhaite prendre la parole.`,
        className: "custom-message",
        duration: 3,
      })
    })

    socket.on("signal", this.signalFromServer)

    socket.on("connect", () => {

      socket.on("redirectToMainPage", () => {
       this.stopTracks()
      });

    socket.emit(
      "joinCall",
      window.location.href,
      this.state.username,
      this.state.currentUserEmail
    )
    socketId = socket.id
    this.setState({ socketId });

    socket.on("update-user-list", (users) => {
      if (users) {
        // si j'fais pas ça il va mdire undefined blablabla
        let updatedUsernames = {}
        users.forEach((user) => {    
          updatedUsernames[user.id] = user.username
        })
        this.setState({ usernames: updatedUsernames })
      } else {
        console.log(
          "Pas encore de user ici.."
        )
      }
    })

      socket.on("chat-message", this.addMessage) // je recupere les messages emit coté serveur pour les display 

      socket.on("userLeft", (id) => {


      
        let video = document.querySelector(`[data-socket="${id}"]`)
        let username = this.state.usernames[id] 

         // J'update l'array usernames quand un user quitte la room "...this.state.usernames" 
         //car je creer une sorte de copie pour effectuer mon delete ensuite jenvoie cette copie à ma vraie state
    const updatedUsernames = { ...this.state.usernames };
    delete updatedUsernames[id]; // du coup je supprime l'utilisateur en supprimant son index id

    this.setState({ usernames: updatedUsernames });
      
      
        if (id !== socketId )  {
          this.playUserDisconnectedSound()
          message.info({
            content: `${username} a quitté la conférence.`,
            className: "custom-message",
            duration: 3,
          })
        }

        if (video !== null) {
          videoElements--
          video.parentNode.removeChild(video)

          let main = document.getElementById("main")
          this.adaptCSS(main)
        }
      })


      socket.on("user-joined", (id, clients, username, email) => {
        console.log(`Utilisateur rejoint: ${username}, ID: ${id}`);
    

  // seul l'user qui s'est fait kick va listen " user-kicked" car c'est emit depuis server spécifiquement à la personne kicked et le reste jte fais pas un dessin       
        socket.on("user-kicked", () => {
          window.location.href = "/";  
          socket.disconnect();
        });

        if (id !== socketId) {
          this.getSources(); // ce salaud j'ai dû le metre ici aussi car en mode prod il faut le relancer quand un autre peer se connecte
          message.success({
            content: `${username} a rejoint la conférence.`,
            className: "custom-message",
            duration: 3,
          })
          // si l'id qui vient d'arriver ne correspond pas à mon socketId (moi) alors je play le sound de cette maniere,
          //seul les utilisateurs déjà présents dans la room entendront le son si un new user arrive dans la room
        }

        
        this.setState((prevState) => ({
          usernames: {
            ...prevState.usernames,
            [id]: username,
          },
        }))

        this.setState((prevState) => ({
          connectedEmails: [...prevState.connectedEmails, email],
        }))
        console.log("Current state of connections:", connections);

        clients.forEach((socketListId) => {
          console.log(`Creating connection for user ${socketListId}`);
          connections[socketListId] = new RTCPeerConnection(peerConnectionConfig);//stockage des sockets id dans ma globale "connections",
          // c'est ici que j'initialise la connection P2P avec webRTC
          console.log("Current state of connections:", connections);

          // je collecte mes iceCandidates
          connections[socketListId].onicecandidate = function (event) {
            if (event.candidate != null) {
              socket.emit(
                "signal", // je spread mes icecandidate via "signal"
                socketListId,
                JSON.stringify({ ice: event.candidate })
              )
            }
          }
   
          // je check si un nouveau user (nouveau videoElement du coup) arrive dans la room
          connections[socketListId].onaddstream = (event) => {
            // c un event de webRTC go voir : https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/addstream_event

            let searchVideo = document.querySelector(
              `[data-socket="${socketListId}"]`
            )


            if (!searchVideo) {              
              console.log(`Creating new video element for socketListId: ${socketListId}`);

              videoElements = clients.length // videoElements = nbr de client connectés à la  room..
              console.log("videoElements: ", videoElements) // test adaptCSS
              let main = document.getElementById("main")
              let cssMesure = this.adaptCSS(main)


              let video = document.createElement("video")

              let css = {
                minWidth: cssMesure.minWidth,
                minHeight: cssMesure.minHeight,
                maxHeight: "100%",
                margin: "10px",
                borderStyle: "solid",
                borderColor: "#bdbdbd",
                objectFit: "fill",
                backgroundImage: `url(${backgroundBlck})`,
                backgroundSize: 'cover', 
                backgroundPosition: 'center', 
                backgroundRepeat: 'no-repeat' 
              };
            
              for (let i in css) video.style[i] = css[i]
            
              video.style.setProperty("width", cssMesure.width)
              video.style.setProperty("height", cssMesure.height)
              video.setAttribute("data-socket", socketListId)
              video.style.borderRadius = "25px"
              video.srcObject = event.stream
              video.autoplay = true
              video.playsinline = true
              video.onclick = this.handleVideoClick
              const videoId = "video_" + socketListId;
              video.setAttribute("id", videoId);
              // video.classList.add("video-with-username");
              // video.setAttribute("data-username", username);
              video.srcObject = event.stream;
              main.appendChild(video)
        
              this.adaptCSS(main);

            }else{
              console.log(`Updating existing video element for socketListId: ${socketListId}`);

              searchVideo.srcObject = event.stream;

            }

          }
            
          if (window.localStream instanceof MediaStream) {
            // Ajout du stream à RTCPeerConnection..
            console.log(`Adding stream to connection for user ${socketListId}`);
            console.log("Current state of connections:", connections);

            connections[socketListId].addStream(window.localStream);
          } else {
            message.error('Votre caméra n\'est pas disponible !!');
          }        
        })

        if (id === socketId) {
          console.log("Local user has joined. Initiating offer creation logic.");
      }
       // Ici, je vais gérer le scénario au cas où un user se co à une salle avec des utilisateurs déjà présents.
       //Cet utilisateur va envoyer son offre à tous les utilisateurs déjà présents dans la salle.        

        if (id === socketId) { // dans cette condition je veux être sûr que celui qui va envoyer son offer à tout lmonde est l'user qui vient de se connecter (genre moi localement quoi)
          
          for (let otherUserId in connections) {  // je loop à travers les autres utilisateurs dans la room
            if (otherUserId === socketId) continue 
        
            let connection = connections[otherUserId];
            console.log('ajout du stream à la connection pour user : ' + otherUserId);
        
            try {
              connection.addStream(window.localStream);
            } catch (e) {
              console.error('Erreur ajout stream à la co :', e);
              continue; // Skip l'itérration pour passer à la suivante si erreur
            }
        
            console.log('Stream bien ajouté. Creation de l offre pour user : ' + otherUserId);
        
            connection
              .createOffer()
              .then((description) => {
                console.log('Offre creee avec succes!. Je set la local description pour user : ' + otherUserId);
                connection.setLocalDescription(description);
              })
              .then(() => {
                console.log('Local description -> OK . envoi du signal pour user ' + otherUserId);
                socket.emit(
                  "signal",
                  otherUserId,
                  JSON.stringify({ sdp: connections[id].localDescription })
                );
              })
              .catch((e) => console.error('Erreur durant création offer ou localdescription ): ', e));
          }
        }
        
      })
    })
  }


  // partage d'ecran
  screenSharePermission = () => {
    if (this.state.screen) {
      //displayMedia c'est le partage donc à ne pas confondre avec usermedia qui est la webcam!
      if (navigator.mediaDevices.getDisplayMedia) {
        //verifie si le partage est dispo (si je partage déjà sur gather ou zoom par exemple, ça marchera pas)
        navigator.mediaDevices
          .getDisplayMedia({ video: true, audio: true }) // je précise un obj d'options(video+audio activés durant partage)
          .then(this.screenShareGranted) // une fois le flux récupéré j'appelle screenShareGranted pour le partage
          .catch((e) => {
            console.log(e)
            this.stopScreenShare()
          })
      }
    }
  }

  screenShareGranted = (screenStream) => {
  
    // Jvais chercher la permission audio du micro (car je veux garder la source  du micro pendant le partage d'écran pas seulement la source audio du système)
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((audioStream) => {
        // J'ajoute l audio track du micro au track du partage d ecran
        const combinedStream = new MediaStream([...screenStream.getTracks(), ...audioStream.getTracks()]);
       
        // j'attribue le stream combiné à la variable globale 
        window.localStream = combinedStream;
        this.myVideo.current.srcObject = combinedStream;
  
        for (let id in connections) {
          if (id === socketId) continue;
  
          connections[id].addStream(combinedStream);
  
          connections[id].createOffer().then((description) => {
    
            connections[id]
              .setLocalDescription(description)
              .then(() => {
                socket.emit(
                  "signal",
                  id,
                  JSON.stringify({ sdp: connections[id].localDescription })
                );
              })
              .catch((e) => console.log(e));
          });
        }
  
        let videoElement = document.querySelector(`[data-socket="${socketId}"]`);
  
        if (videoElement) {
          this.requestFullScreen(videoElement);
        }
  
        combinedStream.getTracks().forEach((track) => {
          track.onended = () => {
            this.setState(
              {
                screen: false,
              },
              () => {
                this.getSources();
              }
            );
          };
        });
      })
      .catch((error) => {
        console.error("Error accessing microphone:", error);
      });
  }
  stopScreenShare = () => {
    const { screen } = this.state;

    if (screen && window.localStream) {
      window.localStream.getTracks().forEach(track => track.stop());
      this.setState({ screen: false });
      this.getSources()
    }

  };

  enterFullScreenMode = (userId) => {
    let videoElement = document.querySelector(`[data-socket="${userId}"]`)
    if (videoElement) {
      this.requestFullScreen(videoElement)
    }
  }

  requestFullScreen = (videoElement) => {
    if (videoElement.requestFullscreen) {
      videoElement.requestFullscreen()
    } else if (videoElement.mozRequestFullScreen) {
      videoElement.mozRequestFullScreen()
    } else if (videoElement.webkitRequestFullscreen) {
      videoElement.webkitRequestFullscreen()
    } else if (videoElement.msRequestFullscreen) {
      videoElement.msRequestFullscreen()
    }
  }

  handleScreenShareStop = () => {
    // en fait tous les navigateurs ont un fullscreen mode de manière native
    if (document.exitFullscreen) {
      document.exitFullscreen()
    } else if (document.mozCancelFullScreen) {
      // pour mozilla
      document.mozCancelFullScreen()
    } else if (document.webkitExitFullscreen) {
      // chrome
      document.webkitExitFullscreen()
    } else if (document.msExitFullscreen) {
      // edge (il me semble lol)
      document.msExitFullscreen()
    }
  }

  adaptCSS(main) {
    let widthMain = main.offsetWidth;
    let minWidth = "30%";
    if ((widthMain * 30) / 100 < 300) {
        minWidth = "300px";
    }
    let minHeight = "40%";
    let height = String(100 / videoElements) + "%";  // videoElements est le nombre total de vidéos
    let width = "";

    if (videoElements === 0 || videoElements === 1) {
        width = "450px";
        height = "500px";
    } else if (videoElements === 2) {
        width = "35%";
    } else if (videoElements === 3 || videoElements === 4) {
        width = "30%";
        height = "50%";
    } else {
        width = String(100 / videoElements) + "%";
    }

    let videos = main.querySelectorAll("video");
    for (let i = 0; i < videos.length; i++) {
        videos[i].style.minWidth = minWidth;
        videos[i].style.minHeight = minHeight;
        videos[i].style.setProperty("width", width);
        videos[i].style.setProperty("height", height);
    }

    return { minWidth, minHeight, width, height };
}


  playUserDisconnectedSound = () => {
    const audio = new Audio(userDisconnectedSound)
    audio.play()
  }


  handleRequestSpeech = () => {
    const { username } = this.state
    socket.emit("speechEvent", { username })
    message.warning({
      content: `Demande de prise de parole en cours..`,
      className: "custom-message",
      duration: 3,
    })
  }

  kickUser = (userId) => {
    socket.emit("kick-user", userId) // j'envoie au serveur l'id du mal aimé à jarter
  }

  stopTracks = () => {
    if (socket) {
      // si je fais pas cette condition j'ai une petite erreur qui s'affiche pendant 1 seconde et fais chauffer mon cpu(??)
      socket.disconnect()
      let tracks = this.myVideo.current.srcObject.getTracks() // kje libere mes tracks pour les autres apps
      tracks.forEach((track) => track.stop())
    }
    window.location.href = "/"
  }

  handleVideoClick = (event) => {
    const videoElement = event.target
    if (videoElement.requestFullscreen) {
      videoElement.requestFullscreen()
    } else if (videoElement.mozRequestFullScreen) {
      //full screen api compatibilité firefopx

      videoElement.mozRequestFullScreen()
    } else if (videoElement.webkitRequestFullscreen) {
      //full screen api compatibilité  chrome et safari (opera aussi je crois)

      videoElement.webkitRequestFullscreen()
    } else if (videoElement.msRequestFullscreen) {
      //full screen api compatibilité edge
      videoElement.msRequestFullscreen()
    }
  }

  // pourquoi !this.state ??? bah parce que ça permute de false à true (clique et reclique) tu comprends mon garçon?
  handleVideo = () => {
    this.setState({ video: !this.state.video }, () => this.getSources())
  }

  handleAudio = () => {
    this.setState({ audio: !this.state.audio }, () => this.getSources())
  }

  handleScreen = () =>
    this.setState({ screen: !this.state.screen }, () =>
      this.screenSharePermission()
    )

  handleEndCall = () => {
    // jte fais pas un dessin ta compris..
    try {
      let tracks = this.myVideo.current.srcObject.getTracks()
      tracks.forEach((track) => track.stop())
      window.location.href = "/"
    } catch (e) {
      console.log(e)
    }
  }

  openChat = () => this.setState({ showModal: true, newmessages: 0 })
  closeChat = () => this.setState({ showModal: false })
  handleMessage = (e) => this.setState({ message: e.target.value })

  addMessage = (data, sender, socketIdSender) => {
    this.setState((prevState) => ({
      messages: [...prevState.messages, { sender: sender, data: data }], // je prend le tableau messages
      //et y ajoute sender et data sans y ecraser les autres msgs dans le tableau messages, tu comprends mon lait ?
    }))

    if (socketIdSender !== socketId) {
      // si c'est pas moi qui envoie le msg, j'incremente le chiffre de la notif d'un new msg
      this.setState({ newmessages: this.state.newmessages + 1 })
    }
  }

  handleUsername = (e) => {
    this.setState({ username: e.target.value })
  }

  handleEmail = (e) => {
    this.setState({ currentUserEmail: e.target.value })
  }

  // handleSubmit jfais pas un dessin..
  handleSubmit = (event) => {
    event.preventDefault()

    const { currentUserEmail, authorizedUsers } = this.state

    let isAuthorized = false
    let isAdmin = false

    for (let i = 0; i < authorizedUsers.length; i++) {
      if (authorizedUsers[i].email === currentUserEmail) {
        isAuthorized = true
        if (authorizedUsers[i].role.includes("ADMIN")) {
          isAdmin = true
        }
        break
      }
    }

    if (isAuthorized) {
      localStorage.setItem(
        "currentUser",
        JSON.stringify({ email: currentUserEmail, isAdmin })
      )

      this.setState({ isAdmin }, () => {
        this.connect()
      })
    } else {
      message.error(
        "Hop hop hop, vous n'êtes pas autorisé à entrer ici, allez zou!"
      )
    }
  }

  sendMessage = () => {
    if (this.state.message.trim() !== "") {
      socket.emit("chat-message", this.state.message, this.state.username) // j'emit les states username et message
      // une fois le message envoyé, jremet l'input à vide et je laisse this.username as sender of course
      this.setState({ message: "", sender: this.state.username })
    }
  }

  copyConfLink = () => {
    let text = window.location.href
    navigator.clipboard.writeText(text).then(() => {
      message.success({
        content: `Lien copié !`,
        className: "custom-message-link",
        duration: 3,
      })
    })
  }

  connect = () =>
    this.setState({ askForUsername: false }, () =>
      this.getMediasAndInitConnection()
    )

  render() {
    return (
      <div>
        {this.state.askForUsername ? (
          <div>
            {this.state.loadingCamera && (
              <div className="spinner">
                {" "}
                <Flex align="center" gap="middle">
                  <Spin size="large" />
                  Chargement...
                </Flex>
              </div>
            )}
            <Link onClick={this.stopTracks}>
              <img
                className="logo"
                src={logo}
                alt=""
                style={{
                  width: "150px",
                  position: "absolute",
                  top: "0",
                  left: "0",
                }}
              />
            </Link>

            <br />
            <br />
            <div className="askUsername">
              <form onSubmit={this.handleSubmit}>
                <input
                  type="email"
                  placeholder="Votre email"
                  name="email"
                  autoComplete="email"
                  onChange={(e) => this.handleEmail(e)}
                  required
                  style={{
                    backgroundColor: "white",
                    borderRadius: "5px",
                    margin: "10px",
                  }}
                />
                <input
                  placeholder="Nom d'utilisateur"
                  type="text"
                  name="text"
                  onChange={(e) => this.handleUsername(e)}
                  required
                  style={{
                    backgroundColor: "white",
                    borderRadius: "5px",
                    margin: "10px",
                  }}
                />
                <Button
                  className="startBtn"
                  type="submit"
                  variant="contained"
                  color="primary"
                >
                  Se connecter
                </Button>
              </form>
            </div>
            <div>
              <video
                id="myVideo"
                className="mx-auto"
                ref={this.myVideo}
                autoPlay
                muted
                style={{
                  objectFit: "fill",
                  width: "100",
                  height: "30%",
                  borderRadius: "25px",
                }}
                onClick={this.handleVideoClick}
              ></video>
            </div>
          </div>
        ) : (
          <div>
            {/* BARRE DE CONTROLES !*/}
            <ControlBar
              username={this.state.username}
              isVideoEnabled={this.state.video}
              isAudioEnabled={this.state.audio}
              isScreenSharing={this.state.screen}
              isScreenSharingAvailable={this.state.screenAvailable}
              isSidebarOpen={this.state.isSidebarOpen}
              newMessagesCount={this.state.newmessages}
              onToggleVideo={this.handleVideo}
              onToggleAudio={this.handleAudio}
              onToggleScreenShare={this.handleScreen}
              onEndCall={this.handleEndCall}
              onOpenChat={this.openChat}
              toggleSidebar={this.toggleSidebar}
              onRequestSpeech={this.handleRequestSpeech}
              usernames={this.state.usernames}
              currentUserEmail={this.state.currentUserEmail}
              isAdmin={this.state.isAdmin}
            />
            {/* je "hide" la modal si showModal est faux( c le cas par défaut of course*/}
            <Rodal
              visible={this.state.showModal}
              onClose={this.closeChat}
              customStyles={{ borderRadius: "25px" }}
            >
              <header>
                <img
                  style={{ width: "80px", borderRadius: "10px" }}
                  src={logo}
                  alt=""
                />
                <br />
                <br />
              </header>

              <div className="bodyRodal">
                {/* Messages */}
                {this.state.messages.length > 0 ? (
                  this.state.messages.map((item, index) => (
                    <div key={index}>
                      <p style={{ wordBreak: "break-all" }}>
                        <b>{item.sender}</b>: {item.data}
                      </p>
                    </div>
                  ))
                ) : (
                  <p style={{ textAlign: "center" }}>
                    Pas encore de message ici...
                  </p>
                )}
              </div>

              <footer className="div-send-msg" style={{ textAlign: "center" }}>
                {/* Message input */}
                <Input
                  className="inputMsg"
                  placeholder="Message"
                  value={this.state.message}
                  onChange={(e) => this.handleMessage(e)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && this.state.message.trim()) {
                      this.sendMessage()
                    }
                  }}
                />
                {/* Send button */}
                <Button
                  className="btnSendMsg"
                  variant="contained"
                  color="primary"
                  onClick={this.sendMessage}
                >
                  Envoyer
                </Button>
              </footer>
            </Rodal>

            <div className="container" style={{ textAlign: "center" }}>
              <img
                style={{ width: "150px", borderRadius: "0 0 10px" }}
                className="logoInConf"
                src={logo}
                alt=""
              />
              <div>
                <Button
                  className="copy"
                  variant="contained"
                  color="primary"
                  onClick={this.copyConfLink}
                >
                  Copier le lien conférence
                </Button>
                {this.state.screen ? (
                  <Button
                    variant="contained"
                    style={{ backgroundColor: "red", color: "white" }}
                    onClick={this.stopScreenShare}
                  >
                    Arrêter le partage d'écran
                  </Button>
                ) : (
                  ""
                )}
              </div>

              <Row
                id="main"
                className="flex-container"
                style={{ margin: 0, padding: 0 }}
              >
                <video
                  id="my-video"
                  ref={this.myVideo}
                  autoPlay
                  muted
                  style={{
                    margin: "10px",
                    objectFit: "fill",
                    width: "550px",
                    height: "500px",
                    borderRadius: "25px",
                    backgroundColor: "black",
                  }}
                  onClick={this.handleVideoClick}
                ></video>
              </Row>

              <div className="video-chat-container">
                <Sidebar
                  usernames={this.state.usernames}
                  isSidebarOpen={this.state.isSidebarOpen}
                  toggleSidebar={this.toggleSidebar}
                  kickUser={this.kickUser}
                  isAdmin={this.state.isAdmin}
                  socketId={this.state.socketId}
                  stopScreenShare={this.stopScreenShare}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
}

export default Main
