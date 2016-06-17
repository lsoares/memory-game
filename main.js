/** ------- Memory JavaScript -....
Testado em Windows [último Chrome, IE 7/8/9/10, FF 18/21, Opera 11.6] / Ubuntu [últimos Chrome/Firefox] em iOS/MacOS [últimos Chrome/Safari]
Quando não se suportam as animações, desligam-se (graceful degradation).
   Luís Soares | http://luissoares.com | Junho 2013  **/
   
/** Representa o provedor dos badges */
var BadgeProvider = function (num, callback) {
    var BADGES_URL = 'https://services.sapo.pt/Codebits/listbadges';
    var choose = function () {
		BadgeProvider.rawBadges.shuffle(); // baralha
		var gameBadges = [];
		for (var i = 0; i < num; i++) {
			gameBadges.push(BadgeProvider.rawBadges[i]);
		}
		callback(gameBadges);
	};
	var store = function (badgesResult) {
		BadgeProvider.rawBadges = badgesResult;
		choose();
	};
    BadgeProvider.rawBadges ? choose() : J50Npi.getJSON(BADGES_URL, {}, store); // realiza um pedido ao SAPO para obter badges
}

/** Encapsula o jogo da memória. */
var MemoryJavaScript = function (cfg) {
    // prepara vars com defaults
    this.w = cfg.width || 5;                            // largura do tabuleiro
    this.h = cfg.height || 4;                           // altura do tabuleiro
    this.cardSize = cfg.cardSize || 75;                 // o tamanho de cada carta; assume-se que cartas são quadradas
	this.defaultBackImg = cfg.defaultBackImg || 'https://i2.wp.com/codebits.eu/logos/defaultavatar.jpg';  // imagem de trás
    this.numPairs = Math.floor((this.w * this.h) / 2);  // a quantidade de pares de cartas
    this.numBadges = cfg.numBadges || this.numPairs;    // a quantidade de tipos de carta
    this.onFinish = cfg.onFinish;                       // callback ao terminar cada jogo
    this.onStart = cfg.onStart;                         // callback ao começar cada jogo
    this.animate = cfg.animate && true;                 // se se vira a carta de forma animada ou não
	this.flipBackTimeout = cfg.flipBackTimeout || 900;  // tempo que demora até se virar a carta de novo para trás 
	// init
    this.board = $(cfg.boardId);                        // onde desenhar o tabuleiro
	this.timer = new Timer('timer');                    // o tempo que já passou desde o iníco do jogo
    preloadImage(this.defaultBackImg);

    /** Buscar os badges */
    this.init = function () {
        var game = this;
        game.moves = 0;
        game.timer.stop();
        game.board.innerHTML = '<img src="http://cdn.jsdelivr.net/wp-advanced-ajax-page-loader/2.5.12/loaders/Atom Loading.gif" />';
        BadgeProvider(game.numPairs, function (gameBadges) {
            game.selectedCard = null;
            game.missingPairs = game.numPairs;
            game.drawCards(gameBadges);
        });
    }
    /** O início do jogo propriamente dito já depois de se ter os badges **/
    this.start = function () {
        this.timer.start();
        this.onStart && this.onStart();
    };
    /** Prepara o DOM do jogo **/
    this.drawCards = function (badges) {
        var game = this;
        var createDOMCard = function (badge) { // TODO: podia ter 1 carta já definina e só fazer clone...
            var front = $$('div');
            addClass(front, 'front');
            setBackgroundImage(front, badge.img, game.cardSize);
            var back = $$('div'); // TODO add keyboard navigation
            addClass(back, 'back');
            setBackgroundImage(back, game.defaultBackImg, game.cardSize);
            on(back, 'click', game.clickCard, game);
            var card = $$('div');
            addClass(card, 'card');
            if (game.animate) {
                addClass(front, 'frontX faceX');
                addClass(back, 'backX faceX');
                addClass(card, 'cardX flippedX');
            } else {
                hide(front);
            }
            card.appendChild(front);
            card.appendChild(back);
            card.badgeId = badge.id; // associa o id do badge
            return card;
        };
        // escolhe badges para o tabuleiro
        boardArray = [];
        for (var i = 0; i < game.numPairs; i++) {
            var badge = badges[i % badges.length];
            preloadImage(badge.img); // assim o utilizador não tem de esperar que seja lida!
            boardArray.push(createDOMCard(badge)); // adiciona o par
            boardArray.push(createDOMCard(badge));
        }
        boardArray.shuffle();
        // prepara DOM do tabuleiro
        game.board.innerHTML = '';
        var X_OFFSET = 20, Y_OFFSET = 0; // poderia ser feita uma "colmeia" se o default fosse hexagonal.....
        for (var j = 0; j < boardArray.length; j++) {
            var card = boardArray[j];
            var rowNum = Math.floor(j / game.w);
            card.style.top = rowNum * (game.cardSize + Y_OFFSET) + 'px';
            card.style.left = (j % game.w) * (game.cardSize + X_OFFSET) + (!isEven(rowNum) ? (game.cardSize + X_OFFSET) / 2 : 0) + 'px';
            game.board.appendChild(card);
        }
    };
    this.isStarted = function () {
        return this.timer.isRunning();
    }
    /** Lidar com um clique numa carta que está virada para baixo.
	Devido ao modelo de eventos do IE<9, tem de receber o jogo... */
    this.clickCard = function (back, game) {
        if (!game.isStarted()) game.start();
        var card = back.parentElement;
        game.moves++;
        game.flipCard(card, true); // mostra a carta clicada
		if (! game.selectedCard) {
			game.selectedCard = card;
			return;   // se ainda não há carta selecionada, seleciona e sai
		}
		if (game.isValidPair(game.selectedCard, card)) { // fez par!
			game.missingPairs--;
			game.checkFinish();
			game.selectedCard = null;
		} else {    // o par não é válido
			if (game.flipping) { // evita que veja + que 2 cartas ao mm tempo
				game.flipCard(game.selectedCard, false);
				game.selectedCard = null;
				game.flipping = false;
			}
			game.flipping = true;
			setTimeout(function() {  // vira a carta após um pouco
				game.flipCard(game.selectedCard, false);
				game.flipCard(card, false);
				game.selectedCard = null;
				game.flipping = false;
			} , game.flipBackTimeout);
		}
    };
    /** Roda a carta */
    this.flipCard = function (card, tog) {
        if (!card) return;
        if (this.animate) {
            toggleClass(card, 'flippedX', !tog);
        } else {
            show(card.children[tog ? 0 : 1]); // o 1º é o front
            hide(card.children[tog ? 1 : 0]); // o 2º é o back
        }
    };
    /** Verifica se duas cartas fazem um par */
    this.isValidPair = function (a, b) {
        return a && b && a.badgeId === b.badgeId;
    };
    /** Verifica se o jogo já acabou; se sim, desencadeia o seu fim. */
    this.checkFinish = function () {
        var game = this;
        if (game.missingPairs <= 0) {
            if (game.onFinish) {
                game.onFinish(game.timer.toString(), game.moves);
            }
            game.timer.stop();
        }
    };
};

/** Utilitários de classes devido ao IE < 10 não ter o classList... */
var addClass = function (el, className) {   // TODO tirar o espaço a mais no fim
    if (!el || el.className === null || hasClass(el, className)) return;
    el.className += className + ' ';
};
var hasClass = function (el, className) {
    return el && el.className && el.className.contains(className);
};
var removeClass = function (el, className) {
    if (!el || !el.className) return;
    el.className = el.className.replace(className, '');
};
var toggleClass = function (el, className, tog) {
    tog ? addClass(el, className) : removeClass(el, className);
};

/** Mostrar/esconder elementos */
var show = function (el) {
    if (el) el.style.display = 'block';
};
var hide = function (el) {
    if (el) el.style.display = 'none';
};

/** Listener de eventos devido ao IE < 9 não ter o addEventListener... */
var on = function (el, type, callback, context) {
	if (!el) return;
    var fixedCallback = function (ev) {
        var target = ev.currentTarget ? ev.currentTarget : ev.srcElement;
        callback(target, context);
    };
    if (el.addEventListener) {
        el.addEventListener(type, fixedCallback);
    } else {
        el.attachEvent('on' + type, fixedCallback);
    }
};

/** Helper para obter elementos por id */
var $ = function (id) {
    return document.getElementById(id);
};
/** Helper para criar elementos */
var $$ = function (type) {
    return document.createElement(type);
};

/** Shuffle de um array - fisher Yates */
Array.prototype.shuffle = function () {
    var i = this.length,
        j, temp;
    if (i === 0) return false;
    while (--i) {
        j = Math.floor(Math.random() * (i + 1));
        temp = this[i];
        this[i] = this[j];
        this[j] = temp;
    }
};

/** Verifica se uma String contém outra */
String.prototype.contains = function (it) {
    return this.indexOf(it) != -1;
};

/** Encapsula um contador de segundos **/
var Timer = function (outId) {
    this.outputTimer = $(outId);
    this.isRunning = function () {
        return this.seconds != null;
    };
    this.start = function () {
        var timer = this;
        timer.stop();
        timer.startTime = new Date();
        timer.updateOutput();
        timer.clock = setInterval(function () {
            timer.seconds = (new Date() - timer.startTime) / 1000;
            timer.updateOutput();
        }, 999);
    };
    this.stop = function () {
        var timer = this;
        timer.seconds = null;
        clearInterval(timer.clock);
    };
    this.toString = function () {
        return secondsToString(this.seconds);
    };
    this.updateOutput = function () {
        var timer = this;
        if (timer.outputTimer) timer.outputTimer.innerHTML = timer.toString();
    }
};

/** Lê imagens assincronamente **/
var preloadImage = function (url) {
    var imageObj = new Image();
    imageObj.src = url;
};

/** Define uma imagem de background. */
var setBackgroundImage = function (el, url, size) {
    el.style.width = el.style.height = size + 'px';
    if (el.style.backgroundSize != undefined) {
        el.style.backgroundImage = 'url(' + url + ')';
        el.style.backgroundSize = size + 'px ' + size + 'px';
    } else { // devido ao IE old não ter o backgroundSize...
        el.style.filter = 'progid:DXImageTransform.Microsoft.AlphaImageLoader(src="' + url + '",sizingMethod="scale")';
    }
};

/** Pedido JSONP */
var J50Npi = {
    currentScript: null,
    getJSON: function (url, data, callback) {
        var src = url + (url.indexOf('?') + 1 ? '&' : '?');
        var head = document.getElementsByTagName('head')[0];
        var newScript = $$('script');
        var params = [];
        var paramName = "";
        this.success = callback;
        data.callback= 'J50Npi.success';
        for (paramName in data) {
            params.push(paramName + "=" + encodeURIComponent(data[paramName]));
        }
        src += params.join('&');
        newScript.type = 'text/javascript';
        newScript.src = src;
        if (this.currentScript) head.removeChild(currentScript);
        head.appendChild(newScript);
    },
    success: null
};

/** Número é par? */
var isEven = function (number) {
    return number % 2 != 0;
};

/** Conversor de segundos para formato mais legível */
var secondsToString = function (seconds) {
    var numMinutes = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
    var numSeconds = (((seconds % 31536000) % 86400) % 3600) % 60;
    return (numMinutes ? (numMinutes + 'm') : '') + ((numMinutes > 0 && numSeconds < 10) ? '0' : '') + Math.round(numSeconds) + 's';
};

/** Capacidades do browser */
var userAgent = window.navigator.userAgent;
var canDoTransforms = !(userAgent.contains('MSIE') || userAgent.contains('Opera') || userAgent.contains('Linux') && userAgent.contains('Chrome'));
// TODO: animações deveriam funcionar no Chrome Linux e no IE10; verificar

//////////////////////// INIT JOGO ///////////////////////////////////////
var output = $('timer');
var twitterMsg = $('twitterMsg');
var startGameBt = $('startGameBt');
hide(startGameBt);
var TWITTER_URL = 'https://twitter.com/intent/tweet/';
var memoryGame = new MemoryJavaScript({
    boardId: 'board',
    animate: canDoTransforms,
    numBadges: 9,
    width: 6,
    height: 3,
    onFinish: function (time, moves) {
        twitterMsg.href = TWITTER_URL + '?text=' + encodeURIComponent('Memory JavaScript FTW em: ' + time);
        show(twitterMsg);
        output.innerHTML += ' - ' + moves + ' jogadas';
    },
    onStart: function () {
        hide(startGameBt); // TODO... em vez de se esconder botões... dever-se-iam desativá-los.
        hide(twitterMsg);
        output.innerHTML = '';
    }
});

// dar início a jogo via botão
var newGameBt = $('newGameBt');
on(newGameBt, 'click', function () {
    memoryGame.init();
    hide(twitterMsg); 
    output.innerHTML = '';
    startGameBt.style.display = '';
});
memoryGame.init();

on(startGameBt, 'click', function () {
    memoryGame.start();
});
on($('title'), 'click', function () {
    location.reload();
});
