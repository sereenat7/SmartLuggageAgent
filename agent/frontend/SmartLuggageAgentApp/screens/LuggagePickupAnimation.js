// screens/LuggagePickupAnimation.js
// Agent walks from house → picks up luggage → carries to airport → plane lifts off
// ALL Animated values use useNativeDriver:true — no mixed-driver crash.
import React, { useEffect, useRef } from 'react';
import {
  View, Text, Animated, StyleSheet, Dimensions, Easing,
} from 'react-native';

const { width: W, height: H } = Dimensions.get('window');
const PRIMARY  = '#E8521A';
const BG       = '#1A0D08';
const GROUND_Y = H * 0.58;

export default function LuggagePickupAnimation({ onFinish }) {
  const ease = Easing.out(Easing.cubic);

  // Scene
  const sceneOp = useRef(new Animated.Value(0)).current;

  // Agent — starts at right, walks left to house, then right to airport
  const agentX = useRef(new Animated.Value(W)).current;
  const agentBend = useRef(new Animated.Value(0)).current;

  // Suitcase on ground — shown before pickup
  const suitGroundOp = useRef(new Animated.Value(1)).current;

  // Suitcase carried — separate translateX + translateY, both native
  const suitX   = useRef(new Animated.Value(W * 0.18)).current; // starts at house
  const suitY   = useRef(new Animated.Value(0)).current;
  const suitCarriedOp = useRef(new Animated.Value(0)).current;

  // Plane
  const planeX  = useRef(new Animated.Value(W * 1.1)).current;
  const planeY  = useRef(new Animated.Value(0)).current;
  const planeOp = useRef(new Animated.Value(0)).current;

  // Captions
  const cap1Op = useRef(new Animated.Value(0)).current;
  const cap2Op = useRef(new Animated.Value(0)).current;
  const cap3Op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // Fade scene in
      Animated.timing(sceneOp, { toValue: 1, duration: 400, useNativeDriver: true }),

      // Caption 1 + agent walks in from right toward house
      Animated.parallel([
        Animated.timing(cap1Op, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(agentX, {
          toValue: W * 0.1, duration: 900, easing: ease, useNativeDriver: true,
        }),
      ]),

      Animated.delay(150),

      // Agent bends to pick up
      Animated.timing(agentBend, {
        toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true,
      }),

      // Suitcase swaps ground→carried + lifts, agent straightens
      Animated.parallel([
        Animated.timing(suitGroundOp, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(suitCarriedOp, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.spring(suitY, { toValue: -38, friction: 6, tension: 100, useNativeDriver: true }),
        Animated.timing(agentBend, {
          toValue: 0, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true,
        }),
      ]),

      Animated.delay(150),

      // Caption swap + agent & suit walk right to airport together
      Animated.parallel([
        Animated.timing(cap1Op, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(cap2Op, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(agentX, {
          toValue: W * 0.72, duration: 1200,
          easing: Easing.inOut(Easing.quad), useNativeDriver: true,
        }),
        Animated.timing(suitX, {
          toValue: W * 0.82, duration: 1200,
          easing: Easing.inOut(Easing.quad), useNativeDriver: true,
        }),
      ]),

      Animated.delay(200),

      // Agent exits right, suitcase stays, caption 3
      Animated.parallel([
        Animated.timing(agentX, {
          toValue: W * 1.3, duration: 600,
          easing: Easing.in(Easing.cubic), useNativeDriver: true,
        }),
        Animated.timing(suitCarriedOp, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(cap2Op, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(cap3Op, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),

      // Plane slides in + lifts
      Animated.parallel([
        Animated.timing(planeOp, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(planeX, {
          toValue: W * 0.2, duration: 950,
          easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
        Animated.timing(planeY, {
          toValue: -H * 0.14, duration: 950,
          easing: Easing.out(Easing.quad), useNativeDriver: true,
        }),
      ]),

      Animated.delay(300),

      // Fade out
      Animated.timing(sceneOp, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start(() => { if (onFinish) onFinish(); });
  }, []);

  const bendRot = agentBend.interpolate({
    inputRange: [0, 1], outputRange: ['0deg', '28deg'],
  });

  return (
    <Animated.View style={[styles.scene, { opacity: sceneOp }]}>

      {/* Stars */}
      {[...Array(16)].map((_, i) => (
        <View key={i} style={{
          position: 'absolute',
          top:  Math.abs(Math.sin(i * 53) * H * 0.26) + H * 0.02,
          left: (i / 16) * W,
          width: i % 4 === 0 ? 3 : 2, height: i % 4 === 0 ? 3 : 2,
          borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)',
        }} />
      ))}

      {/* Ground */}
      <View style={styles.ground} />
      <View style={styles.groundFill} />
      {[0.08, 0.22, 0.38, 0.54, 0.70, 0.86].map((x, i) => (
        <View key={i} style={[styles.roadDash, { left: W * x }]} />
      ))}

      {/* House */}
      <View style={[styles.houseWrap, { left: W * 0.02 }]}>
        <View style={styles.chimney} />
        <View style={styles.roof} />
        <View style={styles.houseBody}>
          <View style={styles.houseWindow} />
          <View style={styles.houseDoor} />
        </View>
      </View>

      {/* Airport */}
      <View style={[styles.airportWrap, { right: W * 0.02 }]}>
        <View style={styles.ctrlStick} />
        <View style={styles.ctrlHead} />
        <View style={styles.terminal}>
          <Text style={styles.termLabel}>AIRPORT</Text>
          <View style={styles.termWindows}>
            {[0,1,2,3,4,5].map(i => <View key={i} style={styles.termWin} />)}
          </View>
        </View>
        <View style={styles.termBase} />
      </View>

      {/* Suitcase on ground (at house) */}
      <Animated.View style={[styles.suitGround, { opacity: suitGroundOp }]}>
        <View style={styles.suit3dSide} />
        <View style={styles.suitFront}>
          <View style={styles.suitHandle} />
          <View style={styles.suitLine} />
          <View style={styles.suitDot} />
        </View>
        <View style={styles.wheelsRow}>
          <View style={styles.wheel} /><View style={styles.wheel} />
        </View>
      </Animated.View>

      {/* Suitcase carried (follows agent) */}
      <Animated.View
        style={[
          styles.suitCarried,
          {
            opacity: suitCarriedOp,
            transform: [{ translateX: suitX }, { translateY: suitY }],
          },
        ]}
      >
        <View style={styles.suit3dSide} />
        <View style={styles.suitFront}>
          <View style={styles.suitHandle} />
          <View style={styles.suitLine} />
          <View style={styles.suitDot} />
        </View>
        <View style={styles.wheelsRow}>
          <View style={styles.wheel} /><View style={styles.wheel} />
        </View>
      </Animated.View>

      {/* Agent */}
      <Animated.View style={[styles.agent, { transform: [{ translateX: agentX }] }]}>
        <View style={styles.agentCap} />
        <View style={styles.agentHead} />
        <Animated.View style={[styles.agentBodyWrap, { transform: [{ rotate: bendRot }] }]}>
          <View style={styles.agentJacket} />
          <View style={styles.agentArm} />
          <View style={styles.agentLegs}>
            <View style={[styles.agentLeg, { transform: [{ rotate: '-5deg' }] }]} />
            <View style={[styles.agentLeg, { transform: [{ rotate: '5deg' }] }]} />
          </View>
        </Animated.View>
      </Animated.View>

      {/* Plane */}
      <Animated.View
        style={[styles.plane, {
          opacity: planeOp,
          transform: [{ translateX: planeX }, { translateY: planeY }, { rotate: '-9deg' }],
        }]}
      >
        <View style={styles.planeTail} />
        <View style={styles.planeFuselage} />
        <View style={styles.planeWing} />
        <View style={styles.planeEngine} />
        {[0,1,2,3].map(i => (
          <View key={i} style={[styles.planeWindow, { left: 24 + i * 14 }]} />
        ))}
      </Animated.View>

      {/* Captions */}
      <View style={styles.captionZone}>
        <Animated.View style={[styles.caption, { opacity: cap1Op }]}>
          <View style={styles.capDot} /><Text style={styles.capText}>Collecting from your door</Text>
        </Animated.View>
        <Animated.View style={[styles.caption, { opacity: cap2Op, position: 'absolute' }]}>
          <View style={styles.capDot} /><Text style={styles.capText}>Heading to the airport</Text>
        </Animated.View>
        <Animated.View style={[styles.caption, { opacity: cap3Op, position: 'absolute' }]}>
          <View style={styles.capDot} /><Text style={styles.capText}>Your luggage is on its way ✈</Text>
        </Animated.View>
      </View>

      {/* Wordmark */}
      <View style={styles.wordmark}>
        <Text style={styles.wordmarkMain}>Smart Luggage</Text>
        <Text style={styles.wordmarkSub}>AGENT PORTAL</Text>
      </View>
    </Animated.View>
  );
}

const GND = GROUND_Y;

const styles = StyleSheet.create({
  scene: { flex: 1, backgroundColor: BG },
  ground:     { position:'absolute', top:GND, left:0, right:0, height:1.5, backgroundColor:'rgba(255,255,255,0.15)' },
  groundFill: { position:'absolute', top:GND+1.5, left:0, right:0, bottom:0, backgroundColor:'rgba(15,7,3,0.9)' },
  roadDash:   { position:'absolute', top:GND+10, width:20, height:2.5, backgroundColor:'rgba(255,255,255,0.1)', borderRadius:2 },

  // House
  houseWrap:   { position:'absolute', bottom: H - GND, alignItems:'center' },
  chimney:     { position:'absolute', top:-22, left:12, width:9, height:18, backgroundColor:'#3D2010', borderRadius:2 },
  roof:        { width:0, height:0, borderLeftWidth:36, borderRightWidth:36, borderBottomWidth:26, borderStyle:'solid', borderLeftColor:'transparent', borderRightColor:'transparent', borderBottomColor:PRIMARY, marginBottom:-2 },
  houseBody:   { width:64, height:48, backgroundColor:'#2C180C', borderWidth:1, borderColor:'rgba(255,255,255,0.07)', flexDirection:'row', alignItems:'center', justifyContent:'space-around', paddingHorizontal:5 },
  houseWindow: { width:12, height:12, backgroundColor:'rgba(255,200,80,0.55)', borderRadius:2 },
  houseDoor:   { width:14, height:24, backgroundColor:PRIMARY, borderRadius:3, borderTopLeftRadius:7, borderTopRightRadius:7, marginBottom:-2 },

  // Airport
  airportWrap: { position:'absolute', bottom: H - GND, flexDirection:'row', alignItems:'flex-end', gap:4 },
  ctrlStick:   { width:8, height:48, backgroundColor:'#3A2010', borderRadius:2 },
  ctrlHead:    { position:'absolute', top:0, right:0, width:18, height:11, backgroundColor:'#4A3018', borderRadius:3 },
  terminal:    { width:60, height:78, backgroundColor:'#2A1808', borderWidth:1, borderColor:'rgba(255,255,255,0.08)', alignItems:'center', paddingTop:7 },
  termLabel:   { color:PRIMARY, fontSize:7, fontWeight:'800', letterSpacing:1.5, marginBottom:5 },
  termWindows: { flexDirection:'row', flexWrap:'wrap', gap:3, paddingHorizontal:4 },
  termWin:     { width:9, height:9, backgroundColor:'rgba(255,200,80,0.45)', borderRadius:1 },
  termBase:    { position:'absolute', bottom:0, width:80, height:14, backgroundColor:'#3A2010' },

  // Suitcase ground
  suitGround: { position:'absolute', top:GND-50, left:W*0.18, alignItems:'flex-start' },
  // Suitcase carried — left:0 because we use translateX
  suitCarried: { position:'absolute', top:GND-50, left:0, alignItems:'flex-start' },
  suit3dSide:  { position:'absolute', top:3, left:52, width:8, height:40, backgroundColor:'#B0390E', borderTopRightRadius:4, borderBottomRightRadius:4, transform:[{skewY:'4deg'}] },
  suitFront:   { width:52, height:40, backgroundColor:PRIMARY, borderRadius:8, alignItems:'center', shadowColor:PRIMARY, shadowOffset:{width:0,height:6}, shadowOpacity:0.5, shadowRadius:10, elevation:8 },
  suitHandle:  { width:16, height:6, borderWidth:2, borderColor:'rgba(255,255,255,0.85)', borderRadius:4, backgroundColor:'transparent', marginTop:-3 },
  suitLine:    { width:42, height:1, backgroundColor:'rgba(255,255,255,0.22)', marginTop:5 },
  suitDot:     { width:6, height:6, borderRadius:3, backgroundColor:'rgba(255,255,255,0.5)', marginTop:4 },
  wheelsRow:   { flexDirection:'row', justifyContent:'space-between', paddingHorizontal:5, width:52, marginTop:2 },
  wheel:       { width:9, height:5, backgroundColor:'#1A1A1A', borderRadius:3, borderWidth:1.5, borderColor:'rgba(255,255,255,0.2)' },

  // Agent
  agent:          { position:'absolute', top:GND-106, left:0, alignItems:'center' },
  agentCap:       { position:'absolute', top:-4, width:24, height:7, backgroundColor:PRIMARY, borderRadius:2, borderTopLeftRadius:7, borderTopRightRadius:7, zIndex:1 },
  agentHead:      { width:20, height:20, borderRadius:10, backgroundColor:'#FDDBB0' },
  agentBodyWrap:  { alignItems:'center', marginTop:2 },
  agentJacket:    { width:24, height:32, backgroundColor:'#1C1208', borderRadius:5, borderWidth:1, borderColor:'rgba(232,82,26,0.35)' },
  agentArm:       { position:'absolute', top:7, right:-9, width:5, height:20, backgroundColor:'#1C1208', borderRadius:3, transform:[{rotate:'18deg'}] },
  agentLegs:      { flexDirection:'row', gap:5, marginTop:2 },
  agentLeg:       { width:9, height:24, backgroundColor:'#0E0A04', borderRadius:3 },

  // Plane
  plane:          { position:'absolute', top:GND-155, left:0 },
  planeFuselage:  { width:105, height:20, backgroundColor:'#E8E8E8', borderRadius:10 },
  planeWing:      { position:'absolute', top:7, left:28, width:52, height:16, backgroundColor:'#C8C8C8', borderBottomLeftRadius:10, borderTopRightRadius:5, transform:[{skewX:'-10deg'}] },
  planeTail:      { position:'absolute', top:-12, right:10, width:20, height:16, backgroundColor:'#C8C8C8', borderTopLeftRadius:5, borderTopRightRadius:9, transform:[{skewX:'8deg'}] },
  planeEngine:    { position:'absolute', top:17, left:38, width:26, height:9, backgroundColor:'#aaa', borderRadius:5 },
  planeWindow:    { position:'absolute', top:4, width:7, height:7, borderRadius:4, backgroundColor:'rgba(100,180,255,0.7)' },

  // Captions
  captionZone: { position:'absolute', top:GND+22, alignSelf:'center', alignItems:'center', height:40, justifyContent:'center' },
  caption:  { flexDirection:'row', alignItems:'center', backgroundColor:'rgba(232,82,26,0.12)', borderWidth:1, borderColor:'rgba(232,82,26,0.3)', borderRadius:20, paddingHorizontal:16, paddingVertical:7, gap:8 },
  capDot:   { width:6, height:6, borderRadius:3, backgroundColor:PRIMARY },
  capText:  { color:PRIMARY, fontSize:13, fontWeight:'600' },

  // Wordmark
  wordmark:     { position:'absolute', bottom:H*0.05, alignSelf:'center', alignItems:'center' },
  wordmarkMain: { color:'#fff', fontSize:18, fontWeight:'800', letterSpacing:-0.3 },
  wordmarkSub:  { color:PRIMARY, fontSize:10, fontWeight:'700', letterSpacing:3, marginTop:3 },
});
