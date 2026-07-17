import { getDisplayImageUris, type ClosetItem } from "@/utils/storage";
import { colors } from "@/utils/theme";
import { Feather } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

type ClosetItemImageProps = {
  item: ClosetItem;
  style?: StyleProp<ViewStyle>;
  contentFit?: "cover" | "contain";
  showPlaceholderLabel?: boolean;
};

export default function ClosetItemImage({
  item,
  style,
  contentFit = "cover",
  showPlaceholderLabel = false,
}: ClosetItemImageProps) {
  const imageUris = getDisplayImageUris(item);
  const imageSourceKey = JSON.stringify(imageUris);
  const [imageIndex, setImageIndex] = useState(0);
  const imageUri = imageUris[imageIndex];

  useEffect(() => {
    setImageIndex(0);
  }, [imageSourceKey]);

  return (
    <View style={[styles.frame, style]}>
      {imageUri ? (
        <ExpoImage
          source={imageUri}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          cachePolicy="memory-disk"
          recyclingKey={`${item.id}-${imageIndex}`}
          onError={() => setImageIndex((currentIndex) => currentIndex + 1)}
        />
      ) : (
        <View style={styles.placeholder}>
          <Feather name="image" size={showPlaceholderLabel ? 26 : 17} color={colors.point} />
          {showPlaceholderLabel ? <Text style={styles.placeholderText}>등록된 사진이 없어요</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
    backgroundColor: colors.softCard,
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: colors.softCard,
  },
  placeholderText: {
    color: colors.subText,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
});
