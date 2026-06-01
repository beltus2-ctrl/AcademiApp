import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export const choisirImageDepuisGalerie = async (): Promise<string | null> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return null;
  }
  const resultat = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: [ 'images' ],
    allowsEditing: true,
    quality: 0.8,
    base64: true,
  });
  if (resultat.canceled) return null;
  return resultat.assets[0].base64 || null;
};

export const prendrePhotoAvecCamera = async (): Promise<string | null> => {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return null;
  }
  const resultat = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.8,
    base64: true,
  });
  if (resultat.canceled) return null;

  const imageManipulee = await ImageManipulator.manipulateAsync(
    resultat.assets[0].uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  return imageManipulee.base64 || null;
};