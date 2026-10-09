import '../../../../../../model/source.dart';

Source get moviesflixSource => _moviesflixSource;

Source _moviesflixSource = Source(
  name: "MoviesFlix",
  baseUrl: "https://moviesflix.uk",
  lang: "en",
  typeSource: "dopeflix",
  itemType: ItemType.anime,
  iconUrl: "https://moviesflix.uk/icon/favicon-32x32.png",
);
