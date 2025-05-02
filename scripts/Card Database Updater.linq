<Query Kind="Statements">
  <NuGetReference>HtmlAgilityPack</NuGetReference>
  <Namespace>HtmlAgilityPack</Namespace>
  <Namespace>System.Collections.Concurrent</Namespace>
  <Namespace>System.Net</Namespace>
  <Namespace>System.Text.Json</Namespace>
  <Namespace>System.Text.Json.Serialization</Namespace>
  <Namespace>System.Threading.Tasks</Namespace>
  <DisableMyExtensions>true</DisableMyExtensions>
</Query>

var sets = new[] 
{
	SetDownloader.Download("Genetic Apex", "A1", new DateTime(2024, 10, 30)),
	SetDownloader.Download("Mythical Island", "A1a", new DateTime(2024, 12, 17)),
	SetDownloader.Download("Space-Time Smackdown", "A2", new DateTime(2025, 01, 30)),
	SetDownloader.Download("Triumphant Light", "A2a", new DateTime(2025, 02, 28)),
	SetDownloader.Download("Shining Revelry", "A2b", new DateTime(2025, 03, 27)),
	SetDownloader.Download("Celestial Guardians", "A3", new DateTime(2025, 04, 30)),
};

CardDatabase.Update(sets);

public static class CardDatabase
{
	private static readonly string FilePath = Path.Combine(Util.CurrentQueryPath, "..\\..\\cardDatabase.json");
	
	public static void Update(Set[] sets)
	{
		Console.WriteLine($"Updating card database: {FilePath}");
		
		var mappedSets = MapSets(sets);
		var json = JsonSerializer.Serialize(mappedSets);
		File.WriteAllText(FilePath, json);
	}
	
	private static object[] MapSets(Set[] sets)
	{
		return sets
			.OrderBy(x => x.ReleaseDate)
			.Select(set =>
			{
				var boosters = set.Cards
					.SelectMany(x => x.Boosters)
					.Distinct()
					.OrderBy(x => x)
					.ToArray();

				return new
				{
					name = set.Name,
					code = set.Code,
					releaseDate = set.ReleaseDate.ToString("yyyy-MM-dd"),
					boosters = boosters,
					cards = set.Cards.Select(card => new
					{
						number = card.Number,
						name = card.Name,
						rarity = card.Rarity,
						type = (int)card.Type,
						boosters = string.Join("", card.Boosters.Select(b => Array.IndexOf(boosters, b))),
					}).ToArray(),
				};
			}).ToArray();
	}
}

public static class SetDownloader
{
	private static readonly HtmlWeb Web = new();
	
	public static Set Download(string name, string code, DateTime releaseDate)
	{
		Console.WriteLine($"Downloading set: {name}");
		
		var cards = DownloadSetCards(name);
		return new Set
		{
			Cards = cards,
			Code = code,
			Name = name,
			ReleaseDate = releaseDate,
		};
	}

	private static Card[] DownloadSetCards(string name)
	{
		var id = name.ToLower().Replace(" ", "");
		var url = $"https://www.serebii.net/tcgpocket/{id}";
		var doc = Web.Load(url);

		return doc.DocumentNode
			.Descendants()
			.Single(x => x.HasClass("dextable"))
			.ChildNodes
			.Where(x => x.Name == "tr")
			.Skip(1)
			.Select(ParseCardFromRow)
			.ToArray();
	}

	private static Card ParseCardFromRow(HtmlNode x)
	{
		var tableData = x.ChildNodes.Where(a => a.Name == "td");
		return new Card
		{
			Rarity = GetRarityFromTableData(tableData),
			Number = GetSetNumberFromTableData(tableData),
			Name = GetNameFromTableData(tableData),
			Type = GetTypeFromTableData(tableData),
			Boosters = GetBoostersFromTableData(tableData),
		};
	}

	private static string GetRarityFromTableData(IEnumerable<HtmlNode> tableData)
	{
		var imgSrc = tableData.First()
			.ChildNodes.Single(a => a.Name == "img")
			.GetAttributeValue("src", "");

		var code = imgSrc.Split("/").Last().Split(".").First();

		return $"{GetRarityCode(code)}{(char.IsDigit(code.Last()) ? code.Last() : "1")}";
	}
	
	private static char GetRarityCode(string name)
	{
		return name == "shiny" ? 'z' : name[0];
	}

	private static int GetSetNumberFromTableData(IEnumerable<HtmlNode> tableData)
	{
		var setNumberRaw = tableData.First()
			.ChildNodes.Last(a => !string.IsNullOrWhiteSpace(a.InnerText))
			.InnerText.Trim();

		return int.Parse(setNumberRaw.Split(" ")[0]);
	}

	private static string GetNameFromTableData(IEnumerable<HtmlNode> tableData)
	{
		return WebUtility.HtmlDecode(tableData.Skip(2).First().InnerText.Trim());
	}

	private static CardType GetTypeFromTableData(IEnumerable<HtmlNode> tableData)
	{
		var rowDescendants = tableData.Skip(3).First().Descendants();
		var colorType = rowDescendants
			.FirstOrDefault(x => x.Name == "img")?
			.GetAttributeValue("src", "").Split("/").Last()?.Trim().Replace(".png", "").Replace("electric", "lightning");

		if (!string.IsNullOrWhiteSpace(colorType))
			return Enum.Parse<CardType>(colorType, true);

		var type = rowDescendants.First().InnerText?.Trim()
			.Replace("Trainer", "Item")
			.Replace("Pok&eacute;mon Tool", "Tool");

		return Enum.Parse<CardType>(type, true);
	}

	private static string[] GetBoostersFromTableData(IEnumerable<HtmlNode> tableData)
	{
		return tableData.Last().Descendants()
			.Where(x => x.Name == "img")
			.Select(x => x.GetAttributeValue("title", "").Replace("Booster Pack", "").Trim())
			.OrderBy(x => x)
			.ToArray();
	}
}

public class Set
{
	public string Name { get; set; }
	public string Code { get; set; }
	public Card[] Cards { get; set; } = [];
	public DateTime ReleaseDate { get; set; }
}

public class Card
{
	public int Number { get; set; }
	public string Name { get; set; }
	public string Rarity { get; set; }
	public CardType Type { get; set; }
	public string[] Boosters { get; set; } = [];
}

public enum CardType
{
	Colorless = 0,
	Grass = 1,
	Fire = 2,
	Water = 3,
	Lightning = 4,
	Fighting = 5,
	Psychic = 6,
	Darkness = 7,
	Metal = 8,
	Dragon = 9,
	Supporter = 10,
	Item = 11,
	Tool = 12
}