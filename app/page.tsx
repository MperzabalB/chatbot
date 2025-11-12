'use client'
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, ThumbsUp, ThumbsDown, Loader2, MessageSquare, X } from 'lucide-react'; // Importar X

// --- Definiciones de Tipos ---

interface Message {
  id: number;
  type: 'user' | 'bot';
  text: string;
  needsFeedback?: boolean;
  feedback?: 'like' | 'dislike' | null;
  showButtons?: boolean;
  buttons?: QuickButton[];
}

interface KnowledgeBaseTemplate {
  intro: string[];
  emoji: string[];
  content: string;
  closing: string[];
}

interface Clarifications {
  start: string[];
  middle: string[];
  end: string[];
}

interface KnowledgeBaseCategory {
  keywords: string[];
  template: KnowledgeBaseTemplate;
  clarifications: Clarifications;
  followUp?: QuickButton[];
}

interface KnowledgeBase {
  [key: string]: KnowledgeBaseCategory;
}

interface Greetings {
  hello: string[];
  goodbye: string[];
  affirmative: string[];
  negative: string[];
  thanks: string[];
  frustration: string[];
}

interface QuickButton {
  label: string;
  category: string;
}

type ConversationState = 'idle' | 'awaiting_more_help' | 'awaiting_clarification';
type DetailState = 'main' | 'promo_detalle_20' | 'promo_detalle_2x1' | 'promo_detalle_envio';

// --- Componente Principal ---

const ChatbotContextual = () => {
  // --- Estados ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [waitingFeedback, setWaitingFeedback] = useState<boolean>(false);
  const [lastBotMessageId, setLastBotMessageId] = useState<number | null>(null);
  const [conversationState, setConversationState] = useState<ConversationState>('idle');
  
  // Estados de Animación de Escritura
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [showTypingDots, setShowTypingDots] = useState<boolean>(false);
  const [typingText, setTypingText] = useState<string>('');
  
  // Contexto y Estado de Conversación
  const [lastCategory, setLastCategory] = useState<string | null>(null);
  const [frustrationLevel, setFrustrationLevel] = useState<number>(0);
  const [clarificationCandidate, setClarificationCandidate] = useState<string | null>(null);
  const [detailState, setDetailState] = useState<DetailState>('main');

  // --- ESTADO: Visibilidad del Chat ---
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- Lógica de Similitud (Levenshtein) ---
  
  const levenshteinDistance = (str1: string, str2: string): number => {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
        }
      }
    }
    return dp[m][n];
  };

  const isSimilar = (word1: string, word2: string, threshold = 2): boolean => {
    if (word1.includes(word2) || word2.includes(word1)) return true;
    return levenshteinDistance(word1, word2) <= threshold;
  };

  // --- Generadores de Respuestas Dinámicas ---

  const generateVariations = (template: KnowledgeBaseTemplate): string => {
    return `${template.intro[Math.floor(Math.random() * template.intro.length)]} ${
      template.emoji[Math.floor(Math.random() * template.emoji.length)]
    }\n\n${template.content}\n\n${
      template.closing[Math.floor(Math.random() * template.closing.length)]
    }`;
  };

  const generateClarification = (category: string): string => {
    const { start, middle, end } = knowledgeBase[category].clarifications;
    return `${start[Math.floor(Math.random() * start.length)]}, ${
      middle[Math.floor(Math.random() * middle.length)]
    } ${end[Math.floor(Math.random() * end.length)]}...`;
  };

  // --- Base de Conocimiento (KB) ---

  const knowledgeBase: KnowledgeBase = {
    promociones: {
      keywords: ['promocion', 'promo', 'descuento', 'oferta', 'rebaja', 'especial', 'sale', '2x1'],
      template: {
        intro: ['¡Tenemos promociones increíbles!', '¡Hay ofertas que te van a encantar!', '¡Mira estas ofertas especiales!'],
        emoji: ['🎉', '🔥', '✨'],
        content: '• 20% de descuento en productos seleccionados\n• 2x1 en categoría de electrónicos\n• Envío gratis en compras mayores a $500',
        closing: ['¿Te interesa alguna en particular?', '¿Quieres saber más de alguna?', '¿Alguna te llama la atención?']
      },
      clarifications: {
        start: ['Perfecto', 'Claro', '¡Buena elección!'],
        middle: ['déjame contarte', 'te cuento', 'aquí van'],
        end: ['sobre nuestras promociones', 'las ofertas que tenemos']
      },
      followUp: [
        { label: 'Sobre el 20% desc.', category: 'promo_detalle_20' },
        { label: 'Sobre el 2x1', category: 'promo_detalle_2x1' },
        { label: 'Sobre el envío gratis', category: 'promo_detalle_envio' },
        { label: '⬅️ Volver', category: 'main_menu' }
      ]
    },
    // Detalles de Promociones (Sub-menú)
    promo_detalle_20: {
      keywords: [], // No se accede por keyword, solo por botón
      template: {
        intro: ['Sobre el 20% de descuento', '¡Claro! El 20% aplica en', 'Esa promo es genial'],
        emoji: ['🛍️', '💰'],
        content: 'El 20% de descuento aplica para toda la categoría de Hogar y Decoración. El descuento se aplica automáticamente al pagar.',
        closing: ['¿Quieres saber de otra promo?', '¿Te ayudo con otra de las promos?']
      },
      clarifications: { start: [''], middle: [''], end: [''] },
      followUp: [
        { label: 'Sobre el 2x1', category: 'promo_detalle_2x1' },
        { label: 'Sobre el envío gratis', category: 'promo_detalle_envio' },
        { label: '⬅️ Volver', category: 'main_menu' }
      ]
    },
    promo_detalle_2x1: {
      keywords: [],
      template: {
        intro: ['Información del 2x1', 'Te cuento del 2x1', '¡Excelente! El 2x1...'],
        emoji: ['💻', '📱'],
        content: 'El 2x1 aplica en electrónicos seleccionados, como audífonos y smartwatches. Pagas el de mayor valor.',
        closing: ['¿Quieres saber de otra promo?', '¿Te ayudo con otra de las promos?']
      },
      clarifications: { start: [''], middle: [''], end: [''] },
      followUp: [
        { label: 'Sobre el 20% desc.', category: 'promo_detalle_20' },
        { label: 'Sobre el envío gratis', category: 'promo_detalle_envio' },
        { label: '⬅️ Volver', category: 'main_menu' }
      ]
    },
    promo_detalle_envio: {
      keywords: [],
      template: {
        intro: ['Sobre el envío gratis', '¡Así es!', 'Te explico lo del envío'],
        emoji: ['🚚', '📦'],
        content: 'El envío gratis se activa en automático en compras de $500 o más (después de descuentos). ¡Así de fácil!',
        closing: ['¿Quieres saber de otra promo?', '¿Te ayudo con otra de las promos?']
      },
      clarifications: { start: [''], middle: [''], end: [''] },
      followUp: [
        { label: 'Sobre el 20% desc.', category: 'promo_detalle_20' },
        { label: 'Sobre el 2x1', category: 'promo_detalle_2x1' },
        { label: '⬅️ Volver', category: 'main_menu' }
      ]
    },
    horarios: {
      keywords: ['horario', 'hora', 'abren', 'cierran', 'abierto', 'atienden'],
      template: {
        intro: ['Nuestros horarios de atención son', 'Te comparto nuestro horario', 'Estamos disponibles en estos horarios'],
        emoji: ['🕐', '⏰', '🕒'],
        content: 'Lunes a Viernes: 9:00 AM - 8:00 PM\nSábados: 10:00 AM - 6:00 PM\nDomingos: 10:00 AM - 4:00 PM',
        closing: ['¿Necesitas algo más?', '¿En qué más puedo ayudarte?', '¿Hay algo más que quieras saber?']
      },
      clarifications: {
        start: ['Claro', 'Por supuesto', 'Con gusto'],
        middle: ['te digo', 'te confirmo', 'te paso'],
        end: ['nuestros horarios', 'los horarios de atención']
      }
    },
    envios: {
      keywords: ['envio', 'enviar', 'entrega', 'envian', 'llega', 'delivery', 'paquete'],
      template: {
        intro: ['Información de envíos', 'Te cuento sobre nuestras entregas', 'Opciones de envío disponibles'],
        emoji: ['📦', '🚚', '📫'],
        content: '• Envío estándar: 3-5 días hábiles ($80)\n• Envío express: 1-2 días hábiles ($150)\n• Envío GRATIS en compras mayores a $500',
        closing: ['¿Quieres hacer un pedido?', '¿Necesitas más información?', '¿Algo más que quieras saber?']
      },
      clarifications: {
        start: ['Perfecto', 'Claro', '¡Buena pregunta!'],
        middle: ['te explico', 'te digo', 'aquí va'],
        end: ['cómo funcionan los envíos', 'la info de entregas']
      }
    },
    pagos: {
      keywords: ['pago', 'pagar', 'tarjeta', 'efectivo', 'transferencia', 'meses', 'credito'],
      template: {
        intro: ['Métodos de pago aceptados', 'Puedes pagar con', 'Aceptamos varios métodos de pago'],
        emoji: ['💳', '💰', '💵'],
        content: '• Tarjetas de crédito/débito (Visa, MasterCard, AMEX)\n• PayPal\n• Transferencia bancaria\n• Efectivo en tienda',
        closing: ['¿Necesitas ayuda con algún método específico?', '¿Te ayudo con algo más?', '¿Alguna pregunta sobre pagos?']
      },
      clarifications: {
        start: ['Por supuesto', 'Claro', 'Con gusto'],
        middle: ['te digo', 'te explico', 'aquí están'],
        end: ['cómo puedes pagar', 'las opciones de pago']
      }
    },
    devolucion: {
      keywords: ['devolucion', 'devolver', 'regreso', 'cambio', 'reembolso', 'garantia'],
      template: {
        intro: ['Política de devoluciones', 'Te explico cómo funcionan las devoluciones', 'Sobre cambios y devoluciones'],
        emoji: ['🔄', '↩️', '🔁'],
        content: '• 30 días para devoluciones\n• Producto en condiciones originales\n• Reembolso completo o cambio',
        closing: ['¿Necesitas iniciar una devolución?', '¿Te ayudo con algún trámite?', '¿Necesitas ayuda con esto?']
      },
      clarifications: {
        start: ['Entendido', 'Claro', 'Por supuesto'],
        middle: ['te explico', 'te cuento', 'aquí está'],
        end: ['la política de devoluciones', 'cómo funcionan las devoluciones']
      }
    },
    contacto: {
      keywords: ['contacto', 'telefono', 'whatsapp', 'email', 'correo', 'llamar', 'agendar', 'cita'],
      template: {
        intro: ['¡Claro! Contáctanos', 'Puedes comunicarte con nosotros', 'Datos de contacto'],
        emoji: ['📞', '📱', '💬'],
        content: 'Teléfono: (55) 1234-5678\nWhatsApp: (55) 9876-5432\nEmail: ayuda@tienda.com\n\nSi quieres agendar una cita, la forma más rápida es por WhatsApp.',
        closing: ['¿Te ayudo a agendar por WhatsApp?', '¿Tienes otra duda?', '¿Prefieres que te llamemos?']
      },
      clarifications: {
        start: ['Claro', 'Por supuesto', 'Perfecto'],
        middle: ['aquí están', 'te paso', 'te comparto'],
        end: ['nuestros datos de contacto', 'cómo comunicarte con nosotros']
      }
    },
    ubicacion: {
      keywords: ['ubicacion', 'direccion', 'donde', 'tienda', 'sucursal', 'local'],
      template: {
        intro: ['Nuestra ubicación', 'Nos encuentras en', 'Estamos ubicados en'],
        emoji: ['📍', '🗺️', '📌'],
        content: 'Av. Principal #123, Col. Centro\nEcatepec de Morelos, Estado de México\nC.P. 55000',
        closing: ['¿Necesitas indicaciones?', '¿Te mando el mapa?', '¿Te ayudo con algo más?']
      },
      clarifications: {
        start: ['Claro', 'Con gusto', 'Perfecto'],
        middle: ['te digo', 'aquí está', 'te paso'],
        end: ['dónde estamos', 'nuestra ubicación', 'la dirección']
      }
    },
    productos: {
      keywords: ['producto', 'catalogo', 'tienen', 'venden', 'disponible', 'stock', 'electronicos', 'ropa'],
      template: {
        intro: ['Nuestro catálogo incluye', 'Manejamos estas categorías', 'Tenemos productos de'],
        emoji: ['🛍️', '🏬', '🛒'],
        content: '• Electrónicos y computadoras\n• Ropa y accesorios\n• Hogar y decoración\n• Deportes y fitness',
        closing: ['¿Qué categoría te interesa?', '¿Buscas algo en particular?', '¿Te interesa alguna categoría?']
      },
      clarifications: {
        start: ['Perfecto', 'Claro', '¡Buena pregunta!'],
        middle: ['te cuento', 'déjame mostrarte', 'aquí va'],
        end: ['qué productos manejamos', 'nuestro catálogo', 'la lista de categorías']
      },
      followUp: [
        { label: 'Electrónicos', category: 'productos' },
        { label: 'Ropa', category: 'productos' },
        { label: 'Hogar', category: 'productos' },
        { label: '⬅️ Volver', category: 'main_menu' }
      ]
    },
    quienEres: {
      keywords: ['quien', 'eres', 'bot', 'robot', 'ia', 'ayuda'],
      template: {
        intro: ['¡Hola! Soy ClinicaBot 🤖', '¡Mucho gusto!', 'Soy ClinicaBot, tu asistente virtual'],
        emoji: ['🤖', '👋', '✨'],
        content: 'Soy un asistente virtual diseñado para ayudarte con tus dudas sobre nuestros servicios.\n\nPuedo darte información sobre:',
        closing: ['¿Sobre qué tema te gustaría preguntar?', '¿En qué te puedo ayudar?']
      },
      clarifications: {
        start: ['¡Claro!', 'Con gusto', 'Perfecto'],
        middle: ['te cuento', 'te explico', 'mira'],
        end: ['quién soy', 'qué hago', 'cómo te ayudo']
      },
      followUp: [ // Reutiliza los botones principales
        { label: 'Ver promociones', category: 'promociones' },
        { label: 'Agendar Cita', category: 'contacto' },
        { label: 'Horarios', category: 'horarios' },
        { label: 'Métodos de pago', category: 'pagos' },
      ]
    }
  };

  // --- Listas de Saludos y Respuestas Rápidas ---

  const greetings: Greetings = {
    hello: ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'que tal', 'hey', 'ola'],
    goodbye: ['adios', 'chao', 'bye', 'hasta luego', 'nos vemos', 'me voy', 'chau'],
    affirmative: ['si', 'sí', 'see', 'sep', 'claro', 'dale', 'ok', 'okay', 'vale', 'simon', 'aja', 'porfa', 'porfavor', 'please', 'exacto'],
    negative: ['no', 'nop', 'nope', 'nel', 'nanai', 'nada', 'tampoco'],
    thanks: ['gracias', 'grax', 'grcs', 'thank', 'thx', 'graciass'],
    frustration: ['no entiendes', 'otra vez', 'ya te dije', 'no sirves', 'mal', 'error', 'no funciona', 'pesimo']
  };

  const mainQuickButtons: QuickButton[] = [
    { label: '¿Quién eres?', category: 'quienEres' },
    { label: 'Ver promociones', category: 'promociones' },
    { label: 'Agendar Cita', category: 'contacto' },
    { label: 'Horarios', category: 'horarios' },
    { label: 'Métodos de pago', category: 'pagos' },
    { label: 'Info. de envíos', category: 'envios' },
  ];

  // --- Funciones de Utilidad ---

  const getRandomResponse = (responses: string[]): string => {
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const getTimeBasedGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return '¡Buenos días!';
    if (hour >= 12 && hour < 19) return '¡Buenas tardes!';
    return '¡Buenas noches!';
  };

  const farewellMessages: string[] = [
    '¡Que tengas un excelente día! 👋 Aquí estaré si me necesitas.',
    '¡Hasta pronto! 😊 Fue un placer ayudarte.',
    '¡Cuídate mucho! 🌟 Vuelve cuando quieras.',
  ];

  const offerMoreHelp: string[] = [
    '¿Hay algo más en lo que pueda asistirte?',
    '¿Necesitas ayuda con algo más?',
    '¿Te puedo ayudar con otra cosa?',
  ];

  // --- useEffects ---

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, showTypingDots]);

  useEffect(() => {
    // Mensaje de bienvenida inicial
    setMessages([{
      id: Date.now(),
      type: 'bot',
      text: `${getTimeBasedGreeting()} 👋 Soy ClinicaBot.\n\n¿En qué puedo ayudarte hoy?`,
      showButtons: true,
      buttons: mainQuickButtons
    }]);
  }, []);

  // --- Lógica de Animación de Escritura ---

  const typeMessage = (text: string, callback: () => void): void => {
    // ¡BUG FIX! Limpiar CUALQUIER intervalo anterior
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }
    
    // 1. Mostrar animación de 3 puntos (pensando)
    setShowTypingDots(true);
    setTypingText(''); // Asegurar que el texto de escritura esté vacío
    
    const thinkingTime = Math.random() * 400 + 800; // 800ms - 1200ms
    
    // Iniciar "pensamiento"
    typingIntervalRef.current = setTimeout(() => {
      // 2. Ocultar puntos y empezar a escribir
      setShowTypingDots(false);
      setIsTyping(true);

      if (text.length === 0) {
          setIsTyping(false);
          callback();
          return;
      }

      const typingSpeed = Math.random() * 10 + 15; // 15ms - 25ms

      let currentText = text[0]; 
      let index = 1; 
      
      setTypingText(currentText); // Poner la PRIMERA letra
      
      // Limpiar el intervalo de "pensamiento"
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }

      // Iniciar "escritura"
      typingIntervalRef.current = setInterval(() => {
        if (index < text.length) {
          currentText = currentText + text[index];
          setTypingText(currentText); 
          index++;
        } else {
          // Terminar escritura
          clearInterval(typingIntervalRef.current);
          setIsTyping(false);
          callback();
        }
      }, typingSpeed);

    }, thinkingTime);
  };

  // --- Detección de Intenciones ---

  const detectIntent = (text: string): string | null => {
    const lowerText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const words = lowerText.split(/\s+/);
    
    let bestMatch = null;
    let maxScore = 0;

    for (const [category, data] of Object.entries(knowledgeBase)) {
      if (category.startsWith('promo_detalle_')) continue; // Ignorar sub-menús

      let score = 0;
      
      for (const keyword of data.keywords) {
        for (const word of words) {
          if (isSimilar(word, keyword)) {
            score += 2;
          }
        }
        if (lowerText.includes(keyword)) {
          score += 1;
        }
      }

      if (score > maxScore) {
        maxScore = score;
        bestMatch = category;
      }
    }
    return maxScore > 0 ? bestMatch : null;
  };

  const detectSimilarKeyword = (text: string): string | null => {
    const lowerText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const words = lowerText.split(/\s+/);
    
    // CORRECCIÓN: Ignorar palabras afirmativas/negativas cortas
    const commonWords = [...greetings.affirmative, ...greetings.negative];
    const filteredWords = words.filter(word => !commonWords.includes(word));

    if (filteredWords.length === 0) return null; // Si solo dijo "si" o "no"

    let bestMatch = null;
    let minDistance = 3; // Umbral de similitud (e.g., "prmsck" vs "promocion")

    for (const category in knowledgeBase) {
      for (const keyword of knowledgeBase[category].keywords) {
        for (const word of filteredWords) { // Usar palabras filtradas
          const distance = levenshteinDistance(word, keyword);
          if (distance > 0 && distance < minDistance) {
            minDistance = distance;
            bestMatch = category;
          }
        }
      }
    }
    return bestMatch;
  };

  // Funciones de comprobación de saludos/respuestas
  const isAffirmative = (text: string): boolean => {
    const lowerText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return greetings.affirmative.some(word => 
      lowerText.split(/\s+/).some(w => isSimilar(w, word, 1))
    );
  };

  const isNegative = (text: string): boolean => {
    const lowerText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return greetings.negative.some(word => 
      lowerText.split(/\s+/).some(w => isSimilar(w, word, 1))
    );
  };

  const isGreeting = (text: string): boolean => {
    const lowerText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return greetings.hello.some(word => lowerText.includes(word));
  };

  const isGoodbye = (text: string): boolean => {
    const lowerText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return greetings.goodbye.some(word => lowerText.includes(word));
  };

  const isThanks = (text: string): boolean => {
    const lowerText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return greetings.thanks.some(word => lowerText.includes(word));
  };

  const isFrustrated = (text: string): boolean => {
    const lowerText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return greetings.frustration.some(phrase => lowerText.includes(phrase));
  };

  // --- Lógica Principal de Envío ---

  const getResponseDelay = (text: string): number => {
    const baseDelay = 600;
    const lengthFactor = Math.min(text.length * 8, 1500);
    return baseDelay + lengthFactor + (Math.random() * 300);
  };

  const handleSend = () => {
    if (input.trim() === '' || isTyping || showTypingDots) return;

    // Desactivar feedback del mensaje anterior
    if (waitingFeedback) {
      setMessages(prev => prev.map(msg => 
        msg.id === lastBotMessageId ? { ...msg, needsFeedback: false } : msg
      ));
      setWaitingFeedback(false);
    }

    const userMessage: Message = {
      id: Date.now(),
      type: 'user',
      text: input
    };
    setMessages(prev => [...prev, userMessage]);

    if (isFrustrated(input)) {
      setFrustrationLevel(prev => prev + 1);
    }

    const currentInput = input;
    setInput('');

    // Retraso para simular "pensamiento"
    setTimeout(() => {
      let responseText = '';
      let needsFeedback = false;
      let responseButtons: QuickButton[] | undefined = undefined;
      let newCategory: string | null = lastCategory;
      let newDetailState: DetailState = detailState;
      let newConversationState: ConversationState = 'idle';

      if (isGoodbye(currentInput)) {
        responseText = getRandomResponse(farewellMessages);
        newCategory = null;
        newDetailState = 'main';
      }
      else if (isThanks(currentInput)) {
        responseText = getRandomResponse([
          '¡De nada! 😊 Para eso estoy aquí.',
          '¡Con gusto! Cuando necesites algo más, aquí estaré.',
        ]);
        // No cambia el estado, puede seguir agradeciendo
      }
      else if (isGreeting(currentInput) && conversationState === 'idle') {
        responseText = getRandomResponse([
          `${getTimeBasedGreeting()} ¿En qué puedo ayudarte?`,
          `¡Hola de nuevo! 😊 ¿Qué necesitas?`,
        ]);
        responseButtons = mainQuickButtons;
        newCategory = null;
        newDetailState = 'main';
      }
      else if (frustrationLevel >= 2) {
        responseText = getRandomResponse([
          'Veo que no he podido ayudarte. 😔 Te recomiendo contactar a un agente humano:\n\n📞 (55) 1234-5678\n💬 WhatsApp: (55) 9876-5432',
          'Lamento no estar siendo de ayuda. 🙁 Un agente humano podrá resolverlo mejor:\n\n📞 (55) 1234-5678\n✉️ ayuda@tienda.com',
        ]);
        setFrustrationLevel(0);
        newCategory = 'contacto'; // El contexto ahora es "contacto"
        newDetailState = 'main';
      }
      // --- Lógica de Aclaración (Sí/No) ---
      else if (conversationState === 'awaiting_clarification') {
        if (isAffirmative(currentInput) && clarificationCandidate) {
          // El usuario dijo "Si" a la sugerencia
          const intent = clarificationCandidate;
          const clarification = generateClarification(intent);
          const mainResponse = generateVariations(knowledgeBase[intent].template);
          responseText = clarification + '\n\n' + mainResponse;
          needsFeedback = true;
          newCategory = intent;
          responseButtons = knowledgeBase[intent].followUp;
          newDetailState = intent === 'promociones' ? 'promo_detalle_20' : 'main'; 
        } else {
          // Dijo "No" o cualquier otra cosa
          responseText = getRandomResponse([
            'Entendido. ¿Sobre qué te gustaría preguntar entonces?',
            'De acuerdo, ¿cómo puedo ayudarte?',
          ]);
          responseButtons = mainQuickButtons;
          newCategory = null;
          newDetailState = 'main';
        }
        setClarificationCandidate(null);
      }
      // --- Lógica de "Más Ayuda" (Sí/No) ---
      else if (conversationState === 'awaiting_more_help') {
        if (isAffirmative(currentInput)) {
          // --- CORRECCIÓN: "Si" CONTEXTUAL ---
          if (lastCategory === 'contacto') {
            responseText = '¡Perfecto! La forma más rápida de agendar es por WhatsApp: (55) 9876-5432. ¿Quieres que te pase el link directo o prefieres que te llamemos?';
            newCategory = 'contacto';
            needsFeedback = true; // Esperar respuesta a la nueva pregunta
          } else {
            responseText = getRandomResponse([
              '¡Perfecto! 😊 ¿Qué más te gustaría saber?',
              '¡Claro! ¿En qué más puedo ayudarte?',
            ]);
            responseButtons = mainQuickButtons;
            newCategory = null;
            newDetailState = 'main';
          }
        } else if (isNegative(currentInput)) {
          // "No" ahora regresa al menú principal
          responseText = getRandomResponse([
            'De acuerdo, ¿hay algo más en lo que pueda ayudarte?',
            'Entendido. ¿Alguna otra cosa que quieras saber?',
          ]);
          responseButtons = mainQuickButtons;
          newCategory = null;
          newDetailState = 'main';
        } else {
          // Si no es "Si" o "No", trata de detectar la intención
          const intent = detectIntent(currentInput);
          if (intent) {
            const clarification = generateClarification(intent);
            const mainResponse = generateVariations(knowledgeBase[intent].template);
            responseText = clarification + '\n\n' + mainResponse;
            needsFeedback = true;
            newCategory = intent;
            responseButtons = knowledgeBase[intent].followUp;
            newDetailState = 'main'; // Resetear detalle
          } else {
             responseText = getRandomResponse([
              'Disculpa, no entendí bien. ¿Necesitas más ayuda o quieres ver el menú principal?',
              'No estoy seguro de captar eso. ¿Te muestro las opciones de nuevo?'
            ]);
            responseButtons = mainQuickButtons;
            newCategory = null;
            newDetailState = 'main';
          }
        }
      }
      // --- Lógica de Intención Principal ---
      else {
        const intent = detectIntent(currentInput);
        
        if (intent) {
          const clarification = generateClarification(intent);
          const mainResponse = generateVariations(knowledgeBase[intent].template);
          responseText = clarification + '\n\n' + mainResponse;
          needsFeedback = true;
          newCategory = intent;
          responseButtons = knowledgeBase[intent].followUp; // Botones contextuales
          
          if (intent === 'promociones') newDetailState = 'promo_detalle_20';
          else newDetailState = 'main';

        } 
        // --- Lógica de "Palabra Mal Escrita" ---
        else {
          const bestMatch = detectSimilarKeyword(currentInput);
          if (bestMatch) {
            const categoryLabel = bestMatch.replace(/_/g, ' '); 
            responseText = `🤔 No te entendí muy bien... ¿quisiste decir "${categoryLabel}"?`;
            setClarificationCandidate(bestMatch);
            newConversationState = 'awaiting_clarification';
            newCategory = null; // Esperando confirmación
          } 
          // --- Lógica de Contexto (Promos/Productos) ---
          else if (
            (lastCategory === 'promociones' || lastCategory === 'productos') && 
            !isAffirmative(currentInput) && 
            !isNegative(currentInput)
          ) {
            responseText = `Disculpa, no tengo detalles específicos sobre "${currentInput}" en el chat, pero puedes ver todo en nuestra tienda en línea.\n\n¿Te puedo ayudar con otra categoría o promoción?`;
            responseButtons = knowledgeBase[lastCategory]?.followUp; // Mostrar botones del contexto anterior
            newCategory = lastCategory; // Mantener el contexto
          }
          // --- No Entendió Nada ---
          else {
            responseText = getRandomResponse([
              '🤔 No estoy seguro de entender tu consulta. ¿Podrías reformularla o elegir una de estas opciones?',
              '😅 Perdón, no capté bien eso. ¿Te ayudaría ver estos temas?',
            ]);
            responseButtons = mainQuickButtons;
            setFrustrationLevel(prev => prev + 1);
            newCategory = null;
            newDetailState = 'main';
          }
        }
      }

      // --- Envío de Mensaje del Bot ---
      typeMessage(responseText, () => {
        const botResponse: Message = {
          id: Date.now() + 1,
          type: 'bot',
          text: responseText,
          needsFeedback: needsFeedback,
          showButtons: !!responseButtons,
          buttons: responseButtons
        };

        setMessages(prev => [...prev, botResponse]);
        
        // --- CORRECCIÓN: Lógica de "awaiting_more_help" ---
        // Solo esperar "Si/No" si NO se mostraron botones.
        if (needsFeedback && !responseButtons) {
          setWaitingFeedback(true);
          setLastBotMessageId(botResponse.id);
          newConversationState = 'awaiting_more_help';
        }
        
        setConversationState(newConversationState);
        setLastCategory(newCategory);
        setDetailState(newDetailState);
      });
    }, getResponseDelay(currentInput)); // Usar el retraso calculado
  };

  // --- Manejadores de Eventos ---

  const handleQuickButton = (label: string, category: string): void => {
    // Limpiar feedback pendiente si se hace clic en un botón
    if (waitingFeedback) {
      setMessages(prev => prev.map(msg => 
        msg.id === lastBotMessageId ? { ...msg, needsFeedback: false } : msg
      ));
      setWaitingFeedback(false);
    }
    
    // Simular que el usuario envió el label del botón
    const userMessage: Message = {
      id: Date.now(),
      type: 'user',
      text: label
    };
    setMessages(prev => [...prev, userMessage]);

    let newCategory: string | null = null;
    let newDetailState: DetailState = 'main';
    let newConversationState: ConversationState = 'idle';

    // Lógica para el botón "Volver"
    if (category === 'main_menu') {
      setTimeout(() => {
        const responseText = '¡Claro! ¿Qué más te gustaría saber?';
        typeMessage(responseText, () => {
          const botResponse: Message = {
            id: Date.now() + 1,
            type: 'bot',
            text: responseText,
            showButtons: true,
            buttons: mainQuickButtons
          };
          setMessages(prev => [...prev, botResponse]);
          setLastCategory(null);
          setDetailState('main');
          setConversationState('idle');
        });
      }, getResponseDelay(label));
      return;
    }

    // Lógica para botones de categorías
    setTimeout(() => {
      const intent = category;
      const clarification = generateClarification(intent);
      const mainResponse = generateVariations(knowledgeBase[intent].template);
      const responseText = (intent.startsWith('promo_detalle_') ? '' : clarification + '\n\n') + mainResponse; // Sin clarificación para sub-menús
      const responseButtons = knowledgeBase[intent].followUp;

      typeMessage(responseText, () => {
        const botResponse: Message = {
          id: Date.now() + 1,
          type: 'bot',
          text: responseText,
          needsFeedback: true,
          showButtons: !!responseButtons,
          buttons: responseButtons
        };
        setMessages(prev => [...prev, botResponse]);
        
        // --- CORRECCIÓN: Lógica de "awaiting_more_help" ---
        if (responseButtons) {
          // Si hay botones, no esperar "Si/No"
          newConversationState = 'idle';
        } else {
          // Si no hay botones (ej. 'horarios'), esperar "Si/No"
          setWaitingFeedback(true);
          setLastBotMessageId(botResponse.id);
          newConversationState = 'awaiting_more_help';
        }

        newCategory = category.startsWith('promo_') ? 'promociones' : category; // Mantener contexto
        newDetailState = category.startsWith('promo_detalle_') ? (category as DetailState) : 'main';
        
        setConversationState(newConversationState);
        setLastCategory(newCategory);
        setDetailState(newDetailState);
      });
    }, getResponseDelay(label)); // Usar el retraso calculado
  };

  const handleFeedback = (id: number, feedback: 'like' | 'dislike') => {
    setMessages(prev => prev.map(msg => 
      msg.id === id ? { ...msg, feedback, needsFeedback: false } : msg
    ));
    setWaitingFeedback(false);
    setConversationState('idle'); // Salir del estado de espera

    // Opcional: Enviar una respuesta de agradecimiento
    const thanksText = feedback === 'like' 
      ? '¡Genial! Me alegra haberte ayudado. 😊' 
      : 'Lamento no haber sido de ayuda. 😔 Intentaré mejorar.';
    
    // Pequeño retraso para la respuesta de feedback
    setTimeout(() => {
       typeMessage(thanksText, () => {
          const botResponse: Message = {
            id: Date.now() + 1,
            type: 'bot',
            text: thanksText,
            showButtons: true, // Mostrar menú principal después del feedback
            buttons: mainQuickButtons
          };
          setMessages(prev => [...prev, botResponse]);
          setConversationState('idle');
          setLastCategory(null);
          setDetailState('main');
       });
    }, 500);
  };

  const handleEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  // --- Renderizado JSX ---

  return (
    // --- CONTENEDOR PRINCIPAL (FLOTANTE) ---
    <div className="fixed bottom-5 right-5 md:bottom-8 md:right-8 z-50">
      
      {/* --- 1. La Ventana del Chat --- */}
      {/* Se oculta/muestra con CSS para persistir el estado */}
      <div 
        className={`
          flex flex-col w-[90vw] max-w-md 
          bg-white shadow-2xl rounded-lg overflow-hidden font-sans
          transition-all duration-300 ease-in-out
          ${isOpen 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-10 pointer-events-none'
          }
        `}
        style={{ height: '70vh', maxHeight: '700px' }} // Altura fija
      >
        
        {/* --- Cabecera (con botón de cerrar) --- */}
        <div className="flex items-center justify-between p-4 bg-gray-100 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">ClinicaBot</h2>
              <p className="text-sm text-green-600">En línea</p>
            </div>
          </div>
          {/* Botón de Cerrar en la cabecera */}
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-full text-gray-500 hover:bg-gray-200"
            aria-label="Cerrar chat"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* --- Área de Mensajes --- */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-gray-50">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-start max-w-xs md:max-w-md ${msg.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                
                {/* Icono del Bot */}
                {msg.type === 'bot' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                    <Bot className="w-5 h-5 text-gray-600" />
                  </div>
                )}
                {/* Icono del Usuario */}
                {msg.type === 'user' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center ml-3">
                    <User className="w-5 h-5 text-gray-600" />
                  </div>
                )}

                {/* Contenido del Mensaje */}
                <div className={`p-3 rounded-lg ${msg.type === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-200 text-gray-800 rounded-bl-none'}`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                  
                  {/* Feedback (Like/Dislike) */}
                  {msg.needsFeedback && (
                    <div className="flex space-x-2 mt-3 pt-2 border-t border-gray-300">
                      <button 
                        onClick={() => handleFeedback(msg.id, 'like')}
                        className="p-1 rounded-full hover:bg-gray-300 transition-colors"
                        aria-label="Respuesta útil"
                      >
                        <ThumbsUp className="w-4 h-4 text-gray-600" />
                      </button>
                      <button 
                        onClick={() => handleFeedback(msg.id, 'dislike')}
                        className="p-1 rounded-full hover:bg-gray-300 transition-colors"
                        aria-label="Respuesta no útil"
                      >
                        <ThumbsDown className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  )}

                  {/* Feedback Recibido */}
                  {msg.feedback === 'like' && (
                    <div className="mt-2 text-xs text-gray-500 flex items-center">
                      <ThumbsUp className="w-3 h-3 mr-1 text-green-500" />
                      <span>¡Útil!</span>
                    </div>
                  )}
                  {msg.feedback === 'dislike' && (
                    <div className="mt-2 text-xs text-gray-500 flex items-center">
                      <ThumbsDown className="w-3 h-3 mr-1 text-red-500" />
                      <span>No fue útil</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {/* --- Animación de "Pensando" (3 puntos) --- */}
          {showTypingDots && (
            <div className="flex justify-start">
              <div className="flex items-start max-w-xs md:max-w-md flex-row">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                    <Bot className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="p-3 rounded-lg bg-gray-200 text-gray-800 rounded-bl-none">
                    <div className="flex space-x-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                    </div>
                  </div>
              </div>
            </div>
          )}

          {/* --- Animación de "Escribiendo" (Texto) --- */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex items-start max-w-xs md:max-w-md flex-row">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                    <Bot className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="p-3 rounded-lg bg-gray-200 text-gray-800 rounded-bl-none">
                    <p className="text-sm whitespace-pre-wrap">{typingText}</p>
                  </div>
              </div>
            </div>
          )}

          {/* --- Botones Rápidos (Chips) --- */}
          {messages.length > 0 && messages[messages.length - 1].type === 'bot' && messages[messages.length - 1].showButtons && !isTyping && !showTypingDots && (
            <div className="flex flex-wrap gap-2 pt-2">
              {messages[messages.length - 1].buttons?.map((btn) => (
                <button
                  key={btn.label}
                  onClick={() => handleQuickButton(btn.label, btn.category)}
                  className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-100 rounded-full shadow-sm hover:bg-blue-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          )}

          {/* Referencia para auto-scroll */}
          <div ref={messagesEndRef} />
        </div>

        {/* --- Área de Input --- */}
        <div className="p-4 bg-gray-100 border-t border-gray-200">
          <div className="flex items-center space-x-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleEnter}
              placeholder={isTyping || showTypingDots ? "ClinicaBot está escribiendo..." : "Escribe tu mensaje..."}
              className="flex-1 px-4 py-2 text-gray-900 placeholder-gray-500 bg-white border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isTyping || showTypingDots}
            />
            <button
              onClick={handleSend}
              className="flex-shrink-0 w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              disabled={isTyping || showTypingDots || input.trim() === ''}
            >
              {isTyping || showTypingDots ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div> 
      {/* Fin de la Ventana del Chat */}

      {/* --- 2. El Botón Flotante (FAB) --- */}
      {/* Solo se muestra si el chat está CERRADO */}
      { !isOpen && (
        <button
          onClick={() => setIsOpen(true)} // <-- Solo abre
          className={`
            absolute bottom-0 right-0 w-16 h-16 bg-blue-500 text-white
            rounded-full shadow-lg flex items-center justify-center
            hover:bg-blue-600 transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-blue-400
          `}
          aria-label="Abrir chat"
        >
          {/* Ping */}
          <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping"></span>
          
          {/* Icono (siempre Bot) */}
          <span className="relative z-10">
            <Bot className="w-7 h-7" />
          </span>
        </button>
      )}

    </div> // Fin del Contenedor Principal
  );
};

export default ChatbotContextual;