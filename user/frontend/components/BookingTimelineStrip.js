import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as bookingSync from '../utils/bookingSync';

export default function BookingTimelineStrip({ booking, compact = false }) {
  const timeline = bookingSync.buildTimeline(booking);

  if (compact) {
    return (
      <View style={styles.compactRow}>
        {timeline.map((item, index) => (
          <View key={item.title} style={styles.compactStep}>
            <View style={[styles.compactDot, item.active ? styles.compactDotActive : styles.compactDotInactive]} />
            {index < timeline.length - 1 ? (
              <View style={[styles.compactLine, item.active && timeline[index + 1]?.active ? styles.compactLineActive : null]} />
            ) : null}
          </View>
        ))}
        <Text style={styles.compactLabel}>{bookingSync.getTrackingStatusLabel(booking)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.timeline}>
      {timeline.map((item, index) => (
        <View key={item.title}>
          <View style={styles.timelineItem}>
            <View style={[styles.timelineDot, { backgroundColor: item.active ? '#ff6600' : '#cbd5e1' }]} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineStatus}>{item.title}</Text>
              <Text style={styles.timelineTime}>{item.timestamp}</Text>
            </View>
          </View>
          {index < timeline.length - 1 ? <View style={styles.timelineLine} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: { paddingVertical: 4 },
  timelineItem: { flexDirection: 'row', marginBottom: 4 },
  timelineDot: { width: 14, height: 14, borderRadius: 7, marginTop: 3, marginRight: 12 },
  timelineContent: { flex: 1 },
  timelineStatus: { fontSize: 13, fontWeight: '700', color: '#1A1C1E' },
  timelineTime: { fontSize: 12, color: '#999', marginTop: 2 },
  timelineLine: { height: 20, width: 2, marginLeft: 6, backgroundColor: '#E5E7EB', marginVertical: -6 },
  compactRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 4 },
  compactStep: { flexDirection: 'row', alignItems: 'center' },
  compactDot: { width: 8, height: 8, borderRadius: 4 },
  compactDotActive: { backgroundColor: '#ff6600' },
  compactDotInactive: { backgroundColor: '#cbd5e1' },
  compactLine: { width: 10, height: 2, backgroundColor: '#cbd5e1', marginHorizontal: 2 },
  compactLineActive: { backgroundColor: '#ff6600' },
  compactLabel: { marginLeft: 8, fontSize: 12, fontWeight: '700', color: '#64748b', flex: 1 },
});
