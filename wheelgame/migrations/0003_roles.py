from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('wheelgame', '0002_appstate_presets'),
    ]

    operations = [
        migrations.AddField(
            model_name='appstate',
            name='roles_data',
            field=models.JSONField(default=dict),
        ),
        migrations.AddField(
            model_name='appstate',
            name='roles_password_hash',
            field=models.CharField(blank=True, default='', max_length=256),
        ),
        migrations.AddField(
            model_name='appstate',
            name='current_role',
            field=models.CharField(default='Yarin', max_length=100),
        ),
    ]
